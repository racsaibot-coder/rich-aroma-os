const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, email, phone, location_id, items, notes, promo_code, is_subscription } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.richaromacoffee.com';
        
        // 1. Check Promo Code / Subscription Discount
        let discountPercent = is_subscription ? 10 : 0;
        let sellerInfo = null;
        
        if (promo_code && !is_subscription) {
            const { data: seller } = await supabase
                .from('customers')
                .select('id, name, referral_code')
                .eq('referral_code', promo_code.toUpperCase())
                .contains('tags', ['cali_seller'])
                .single();
            
            if (seller) {
                discountPercent = 5;
                sellerInfo = seller;
            }
        }

        // 2. Prepare Stripe Line Items and Order Notes
        const lineItems = [];
        let combinedNotes = is_subscription ? `[SUBSCRIPTION ORDER] ${notes || ''}\n` : `[CALI ORDER] ${notes || ''}\n`;
        let totalAmount = 0;
        let totalBottles = 0;

        for (const item of items) {
            let itemDescription = "";
            const itemBottles = item.selections ? item.selections.length : 1;
            totalBottles += (itemBottles * parseInt(item.qty));

            if (item.selections && Array.isArray(item.selections)) {
                itemDescription = item.selections.map((s, i) => `#${i+1}: ${s.flavor} (${s.milk})`).join(', ');
            } else {
                itemDescription = `Flavor: ${item.flavor || 'N/A'}, Milk: ${item.milk || 'N/A'}`;
            }

            let unitPrice = item.unitPrice;
            if (discountPercent > 0) {
                unitPrice = unitPrice * (1 - (discountPercent / 100));
            }

            const lineItem = {
                price_data: {
                    currency: 'usd',
                    product_data: { 
                        name: item.name + (discountPercent > 0 ? ` (${discountPercent}% OFF)` : ''),
                        description: itemDescription
                    },
                    unit_amount: Math.round(unitPrice * 100),
                },
                quantity: parseInt(item.qty),
            };

            if (is_subscription) {
                lineItem.price_data.recurring = { interval: 'week' };
            }

            lineItems.push(lineItem);
            combinedNotes += `- ${item.qty}x ${item.name} [${itemDescription}]\n`;
            totalAmount += (unitPrice * item.qty);
        }

        if (sellerInfo) {
            const commission = totalBottles * 1.00;
            combinedNotes += `\n[PROMO: ${promo_code.toUpperCase()}] Seller: ${sellerInfo.name}\nCommission: $${commission.toFixed(2)}`;
        }

        // 3. Create initial entry in DB (as pending order)
        const { data: order, error: orderErr } = await supabase
            .from('cali_orders')
            .insert({
                customer_name: name || 'Guest',
                customer_phone: phone || '',
                location_id: location_id,
                total: totalAmount,
                selections: { 
                    cart: items, 
                    promo: promo_code ? promo_code.toUpperCase() : null,
                    discount: discountPercent,
                    seller_id: sellerInfo ? sellerInfo.id : null,
                    commission: sellerInfo ? totalBottles * 1.0 : 0,
                    is_subscription: !!is_subscription
                },
                status: 'pending',
                notes: combinedNotes + (email ? `\nCustomer Email: ${email}` : '')
            })
            .select()
            .single();

        if (orderErr) {
            console.error("Supabase Insert Error:", orderErr);
            throw new Error('Order creation failed (V2): ' + orderErr.message);
        }

        // 4. Create Stripe Session
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(200).json({ url: `${baseUrl}/cali?success=true&order=${order.id}` });
        }

        const sessionPayload = {
            customer_email: email || undefined,
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: is_subscription ? 'subscription' : 'payment',
            success_url: `${baseUrl}/cali?success=true&order=${order.id}`,
            cancel_url: `${baseUrl}/cali?canceled=true`,
            metadata: { 
                order_id: order.id,
                type: 'cali_distro',
                is_subscription: is_subscription ? 'true' : 'false',
                customer_email: email || ''
            }
        };

        // CashApp not supported for subscriptions
        if (!is_subscription) sessionPayload.payment_method_types.push('cashapp');

        const session = await stripe.checkout.sessions.create(sessionPayload);

        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
};
