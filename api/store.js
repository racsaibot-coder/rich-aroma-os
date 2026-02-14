// api/store.js
const { supabase } = require('./lib/supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query; 

    // MENU
    if (action === 'menu' && req.method === 'GET') {
        const { data: items } = await supabase.from('menu_items').select('*').eq('available', true);
        const { data: modifiers } = await supabase.from('menu_modifiers').select('*');
        // (Grouping logic omitted for brevity - frontend can handle or we copy paste)
        return res.json({ items, modifiers, taxRate: 0.15 });
    }

    // ORDERS
    if (action === 'orders' && req.method === 'POST') {
        const { items, total, customerId, paymentMethod, notes } = req.body;
        const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
        const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
        const id = `ORD-${String(orderNum).padStart(4, '0')}`;
        const { data } = await supabase.from('orders').insert({
            id, order_number: orderNum, items, total, customer_id: customerId, payment_method: paymentMethod, status: 'pending', notes
        }).select().single();
        return res.json(data);
    }

    // LIVE DROP
    if (action === 'live-status' && req.method === 'GET') {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'live_drop').single();
        return res.json(data?.value || { active: false });
    }

    // UPLOAD RECEIPT
    if (action === 'upload-receipt' && req.method === 'POST') {
        const { imageBase64, ticketCode, refNumber } = req.body;
        const { data: existingRef } = await supabase.from('receipts').select('id').eq('ref_number', refNumber).single();
        if (existingRef) return res.status(409).json({ error: "Used ref" });
        await supabase.from('receipts').insert({ ticket_code: ticketCode, ref_number: refNumber });
        return res.json({ success: true });
    }

    // VALENTINE CAMPAIGN
    if (action === 'valentines' && req.method === 'POST') {
        const { name, kidName, phone } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');
        let { data: customer } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        
        if (!customer) {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            const { data: newCust } = await supabase.from('customers').insert({
                id: newId, name: name, phone: cleanPhone, tier: 'bronze', points: 0, notes: `Kid: ${kidName}`
            }).select().single();
            customer = newCust;
        }
        
        await supabase.from('creator_submissions').insert({
            phone: cleanPhone, creator_name: kidName, platform: 'valentine_art', status: 'approved', points_awarded: 50
        });
        
        // Manual point update (RPC might be missing)
        const currentPoints = (customer.points || 0) + 50;
        await supabase.from('customers').update({ points: currentPoints }).eq('id', customer.id);
        
        return res.json({ success: true });
    }

    res.status(404).json({ error: 'Action not found' });
}