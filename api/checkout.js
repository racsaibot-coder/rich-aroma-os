const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, phone, distributor_id, flavor, milk, quantity, notes } = req.body;

        if (!flavor || !milk || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const isBundle = quantity === '3_bundle';
        const parsedQty = isBundle ? 1 : parseInt(quantity);
        const numBottles = isBundle ? 3 : parsedQty;

        // Fetch all products to match
        const { data: products } = await supabase.from('cali_products').select('*');
        let product;
        if (isBundle) {
            product = products.find(p => p.name.includes('Bundle'));
        } else {
            product = products.find(p => p.name.toLowerCase().includes(flavor.toLowerCase()));
        }

        if (!product) {
            return res.status(404).json({ error: 'Product not found in database' });
        }

        // Calculate Price
        let basePrice = parseFloat(product.price);
        let milkSurcharge = milk === 'Oat Milk' ? (isBundle ? 3.00 : 1.00) : 0;
        let unitPrice = basePrice + milkSurcharge;
        let total = unitPrice * parsedQty;

        const description = `${isBundle ? 'Bundle of 3 (Mix)' : flavor} with ${milk}`;
        const fullNotes = `Flavor: ${flavor} | Milk: ${milk} | ${notes || ''}`;

        // Create Order
        const { data: order, error: orderErr } = await supabase
            .from('cali_orders')
            .insert({
                customer_name: name || 'Guest',
                customer_phone: phone || '',
                location_id: distributor_id || null,
                total: total,
                status: 'pending',
                notes: fullNotes
            })
            .select()
            .single();

        if (orderErr) throw new Error('Failed to create order record: ' + orderErr.message);

        await supabase.from('cali_order_items').insert({
            order_id: order.id,
            product_id: product.id,
            quantity: parsedQty,
            price_at_time: unitPrice
        });

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.richaromacoffee.com';

        // Check if Stripe is configured
        if (!process.env.STRIPE_SECRET_KEY) {
            // For now, if no Stripe key, just mark as pending and show success
            return res.status(200).json({ url: `${baseUrl}/cali?success=true&order=${order.id}&noshripe=true` });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'cashapp'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: description },
                    unit_amount: Math.round(unitPrice * 100),
                },
                quantity: parsedQty,
            }],
            mode: 'payment',
            success_url: `${baseUrl}/cali?success=true&order=${order.id}`,
            cancel_url: `${baseUrl}/cali?canceled=true`,
            metadata: { order_id: order.id }
        });

        await supabase.from('cali_orders').update({ payment_link: session.url }).eq('id', order.id);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
};