const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./lib/supabase');
const fetch = require('node-fetch');

async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn("[Email] RESEND_API_KEY not found. Skipping email.");
        return;
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: process.env.FROM_EMAIL || 'Rich Aroma <orders@richaromacoffee.com>',
                to,
                subject,
                html
            })
        });

        const data = await res.json();
        console.log("[Email] Sent:", data);
        return data;
    } catch (err) {
        console.error("[Email] Failed:", err);
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            event = req.body; 
        } else {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    try {
        // 1. Handle initial successful payment (One-time or first Subscription charge)
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderId = session.metadata.order_id;
            const isSub = session.metadata.is_subscription === 'true';
            const customerEmail = session.metadata.customer_email || session.customer_details?.email;

            if (session.metadata.type === 'cali_distro' && orderId) {
                // Update the initial order to paid
                await supabase.from('cali_orders').update({ 
                    status: 'paid',
                    notes: `[PAID] Stripe Session: ${session.id}` 
                }).eq('id', orderId);

                // Send Confirmation Emails
                if (customerEmail) {
                    await sendEmail({
                        to: customerEmail,
                        subject: 'Order Confirmed - Rich Aroma Cali Distro',
                        html: `<h1>Thank you for your order!</h1><p>We've received your payment for order <strong>${orderId}</strong>.</p><p>We will brew your batch this Sunday and deliver it fresh Monday morning.</p>`
                    });
                }

                // Notify Owner
                if (process.env.OWNER_EMAIL) {
                    await sendEmail({
                        to: process.env.OWNER_EMAIL,
                        subject: 'New Order Received - Cali Distro',
                        html: `<h1>New Order Received!</h1><p>Order ID: ${orderId}</p><p>Customer: ${session.customer_details?.name}</p><p>Total: $${(session.amount_total / 100).toFixed(2)}</p>`
                    });
                }

                // If it's a subscription, create the record in cali_subscriptions
                if (isSub && session.subscription) {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    
                    // Get selections from the original order
                    const { data: originalOrder } = await supabase.from('cali_orders').select('*').eq('id', orderId).single();

                    if (originalOrder) {
                        await supabase.from('cali_subscriptions').insert({
                            customer_name: originalOrder.customer_name,
                            customer_email: customerEmail || '',
                            customer_phone: originalOrder.customer_phone,
                            location_id: originalOrder.location_id,
                            selections: originalOrder.selections,
                            stripe_subscription_id: session.subscription,
                            stripe_customer_id: session.customer,
                            status: 'active',
                            total: originalOrder.total
                        });
                    }
                }
            }
        }

        // 2. Handle recurring subscription payments
        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            if (invoice.subscription) {
                const { data: sub } = await supabase
                    .from('cali_subscriptions')
                    .select('*')
                    .eq('stripe_subscription_id', invoice.subscription)
                    .single();

                if (sub && sub.status === 'active') {
                    // Create a new order for this week's delivery
                    const { data: newOrder } = await supabase.from('cali_orders').insert({
                        customer_name: sub.customer_name,
                        customer_email: sub.customer_email || '',
                        customer_phone: sub.customer_phone,
                        location_id: sub.location_id,
                        total: sub.total,
                        status: 'paid',
                        selections: sub.selections,
                        subscription_id: sub.id,
                        notes: `[RECURRING] Week of ${new Date().toLocaleDateString()}\nStripe Invoice: ${invoice.id}`
                    }).select().single();

                    // Notify Customer of recurring order
                    if (sub.customer_email) {
                        await sendEmail({
                            to: sub.customer_email,
                            subject: 'Recurring Order Processed - Rich Aroma',
                            html: `<h1>Your weekly batch is being prepared!</h1><p>Your subscription payment for the week of ${new Date().toLocaleDateString()} was successful.</p>`
                        });
                    }
                }
            }
        }

        // 3. Handle Subscription Cancellations
        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            await supabase
                .from('cali_subscriptions')
                .update({ status: 'canceled' })
                .eq('stripe_subscription_id', subscription.id);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: error.message });
    }
};
