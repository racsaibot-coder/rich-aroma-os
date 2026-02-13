// api/orders.js
const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        // Fetch Orders
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ orders: data });
    }

    if (req.method === 'POST') {
        // Create Order
        const { items, total, customerId, paymentMethod, notes } = req.body;
        
        // 1. Generate ID (Serverless safe: rely on DB or UUID, but here simulating previous logic)
        // Ideally DB does this via triggers, but we'll do a simple fetch-and-increment for now (not race-condition safe but okay for MVP)
        const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
        const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
        const id = `ORD-${String(orderNum).padStart(4, '0')}`;

        const { data, error } = await supabase.from('orders').insert({
            id,
            order_number: orderNum,
            items,
            total,
            customer_id: customerId,
            payment_method: paymentMethod,
            status: 'pending',
            notes
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    res.status(405).json({ error: 'Method Not Allowed' });
}