// api/reserve.js
const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { name, phone, pin } = req.body;

    // Check limit
    const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_vip', true);
        
    if (count >= 50) return res.status(400).json({ error: "Sold out." });

    const ticketCode = "RA-F" + Math.floor(100 + Math.random() * 900);
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if exists
    const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();

    if (existing) {
        await supabase.from('customers').update({ 
            notes: `RESERVED: Founder Ticket ${ticketCode}`,
            pin: pin || null 
        }).eq('id', existing.id);
    } else {
        const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
        const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
        const newId = `C${String(nextNum).padStart(3, '0')}`;
        
        await supabase.from('customers').insert({
            id: newId,
            name,
            phone: cleanPhone,
            tier: 'bronze',
            points: 0,
            pin: pin || null,
            notes: `RESERVED: Founder Ticket ${ticketCode}`
        });
    }

    res.json({ success: true, ticketCode });
}