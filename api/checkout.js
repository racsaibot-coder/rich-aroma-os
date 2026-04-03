const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, phone, location_id, items, notes } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.richaromacoffee.com';
        
        // 1. Prepare Stripe Line Items and Order Notes
        const lineItems = [];
        let combinedNotes = `[CALI ORDER] ${notes || ''}\n`;
        let totalAmount = 0;

        for (const item of items) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { 
                        name: `${item.name} (${item.flavor})`,
                        description: `Milk: ${item.milk}`
                    },
                    unit_amount: Math.round(item.unitPrice * 100),
                },
                quantity: parseInt(item.qty),
            });
            combinedNotes += `- ${item.qty}x ${item.name} (${item.flavor}, ${item.milk})\n`;
            totalAmount += (item.unitPrice * item.qty);
        }

        // 2. Create Order in DB
        const { data: order, error: orderErr } = await supabase
            .from('cali_orders')
            .insert({
                customer_name: name || 'Guest',
                customer_phone: phone || '',
                location_id: location_id,
                quantity: items.reduce((sum, i) => sum + parseInt(i.qty), 0),
                total_price: totalAmount,
                selections: { cart: items },
                payment_status: 'pending',
                notes: combinedNotes
            })
            .select()
            .single();

        if (orderErr) throw new Error('Order creation failed: ' + orderErr.message);

        // 3. Create Stripe Session
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(200).json({ url: `${baseUrl}/cali?success=true&order=${order.id}` });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'cashapp'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${baseUrl}/cali?success=true&order=${order.id}`,
            cancel_url: `${baseUrl}/cali?canceled=true`,
            metadata: { 
                order_id: order.id,
                type: 'cali_distro'
            }
        });

        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
};
