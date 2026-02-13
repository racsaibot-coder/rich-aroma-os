// api/admin.js
const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id } = req.query; // ?action=founders, ?action=verify-founder

    // GET FOUNDERS
    if (action === 'founders' && req.method === 'GET') {
        const { data: founders } = await supabase.from('founders').select('*').order('created_at', { ascending: false });
        const confirmed = (founders || []).filter(f => f.status === 'confirmed');
        const pending = (founders || []).filter(f => f.status === 'pending');
        return res.json({ sold: confirmed.length, revenue: confirmed.length * 1500, pending, confirmed });
    }

    // ADD FOUNDER
    if (action === 'founders' && req.method === 'POST') {
        const { name, phone, ref, status } = req.body;
        const { count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
        const ticket = 'RA-F' + ((count || 0) + 1).toString().padStart(3, '0');
        const { data, error } = await supabase.from('founders').insert({
            name, phone: phone.replace(/\D/g, ''), ticket, ref_notes: ref || 'CASH', status: status || 'pending', amount: 1500
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, entry: data });
    }

    // DELETE FOUNDER
    if (action === 'founders' && req.method === 'DELETE' && id) {
        const { error } = await supabase.from('founders').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // VERIFY FOUNDER
    if (action === 'verify-founder' && req.method === 'POST') {
        const { id } = req.body;
        const { data: founder } = await supabase.from('founders').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', id).select().single();
        
        // Upgrade Customer
        const cleanPhone = founder.phone.replace(/\D/g, '');
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        if (existing) {
            await supabase.from('customers').update({ is_vip: true, tier: 'gold', notes: `FOUNDER: ${founder.ticket}` }).eq('id', existing.id);
        } else {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            await supabase.from('customers').insert({ id: newId, name: founder.name, phone: cleanPhone, tier: 'gold', is_vip: true, points: 500, notes: `FOUNDER: ${founder.ticket}` });
        }
        return res.json({ success: true, founder });
    }

    res.status(404).json({ error: 'Action not found' });
}