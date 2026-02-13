// api/admin/verify-founder.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).end();

    const { id } = req.body;

    // 1. Update Founder Status
    const { data: founder, error } = await supabase
        .from('founders')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // 2. Auto-Upgrade Customer (if exists)
    const cleanPhone = founder.phone.replace(/\D/g, '');
    const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();

    if (existing) {
        await supabase.from('customers').update({
            is_vip: true,
            tier: 'gold',
            notes: `FOUNDER: ${founder.ticket} (Verified)`
        }).eq('id', existing.id);
    } else {
        // Create new
        const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
        const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
        const newId = `C${String(nextNum).padStart(3, '0')}`;
        
        await supabase.from('customers').insert({
            id: newId,
            name: founder.name,
            phone: cleanPhone,
            tier: 'gold',
            is_vip: true,
            points: 500,
            notes: `FOUNDER: ${founder.ticket} (Auto-Created)`
        });
    }

    res.json({ success: true, founder });
}