// api/store.js
const { supabase } = require('./lib/supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query; 

    // CUSTOMER LOOKUP
    if (action === 'customer_by_phone' && req.method === 'GET') {
        const query = req.query.query;
        if (!query) return res.status(400).json({ error: 'Missing query' });
        const { data, error } = await supabase.from('customers').select('*').eq('phone', query).single();
        if (error || !data) return res.status(404).json({ error: 'Not found' });
        return res.json(data);
    }

    // CUSTOMER PROFILE
    if (action === 'customer_profile' && req.method === 'GET') {
        const query = req.query.phone;
        if (!query) return res.status(400).json({ error: 'Missing phone' });
        const { data, error } = await supabase.from('customers').select('*').eq('phone', query).single();
        if (error || !data) return res.status(404).json({ error: 'Not found' });
        return res.json(data);
    }

    if (action === 'customer_test_cash' && req.method === 'POST') {
        const { phone } = req.body;
        const { data: customer } = await supabase.from('customers').select('*').eq('phone', phone).single();
        if (!customer) return res.status(404).json({ error: 'Not found' });
        
        const { data, error } = await supabase.from('customers').update({ 
            cash_balance: (customer.cash_balance || 0) + 500 
        }).eq('phone', phone).select().single();
        
        return res.json(data);
    }

    // CUSTOMER UPDATE (PIN etc)
    if (action === 'customer_update' && req.method === 'PATCH') {
        const id = req.query.id;
        const { pin, notes } = req.body;
        const { data, error } = await supabase.from('customers').update({ pin, notes }).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    // MENU
    if (action === 'menu' && req.method === 'GET') {
        const { data: items } = await supabase.from('menu_items').select('*').eq('available', true);
        
        // Fetch new dynamic modifiers
        const { data: itemModGroups } = await supabase.from('item_modifier_groups').select('item_id, group_id, display_order');
        const { data: modGroups } = await supabase.from('modifier_groups').select('*');
        const { data: modOptions } = await supabase.from('modifier_options').select('*');
        
        return res.json({ items, itemModGroups, modGroups, modOptions, taxRate: 0.15 });
    }

    // ORDERS
    if (action === 'orders' && req.method === 'GET') {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ orders: data });
    }

    if (action === 'orders' && req.method === 'POST') {
        const { items, subtotal, tax, discount, total, customerId, paymentMethod, notes } = req.body;
        const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
        const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
        const id = `ORD-${String(orderNum).padStart(4, '0')}`;
        
        const { data, error } = await supabase.from('orders').insert({
            id, order_number: orderNum, items, subtotal: subtotal || 0, tax: tax || 0, discount: discount || 0, total, customer_id: customerId, payment_method: paymentMethod, status: 'pending', notes
        }).select().single();
        
        if (error) {
            console.error("Order Insert Error:", error);
            return res.status(500).json({ error: error.message });
        }
        return res.json(data);
    }

    if (action === 'order_update' && req.method === 'PATCH') {
        const id = req.query.id;
        const { status } = req.body;
        const { data } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
        return res.json(data);
    }

    if (action === 'order_assign' && req.method === 'PATCH') {
        const id = req.query.id;
        const { driverId } = req.body;
        const { data } = await supabase.from('orders').update({ driver_id: driverId }).eq('id', id).select().single();
        return res.json(data);
    }

    if (action === 'employees' && req.method === 'GET') {
        const { data } = await supabase.from('employees').select('*');
        return res.json({ employees: data });
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