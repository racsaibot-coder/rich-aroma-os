// api/auth/register.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { name, phone, email, secret, type } = req.body; 

    try {
        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
        const cleanEmail = email ? email.toLowerCase() : null;

        // 1. Check Duplicates
        if (cleanPhone) {
            const { data } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
            if (data) return res.status(400).json({ error: 'Phone already registered' });
        }

        // 2. Generate ID
        const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
        const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
        const newId = `C${String(nextNum).padStart(3, '0')}`;

        // 3. Insert
        const newUser = {
            id: newId,
            name,
            phone: cleanPhone,
            email: cleanEmail,
            points: 0,
            tier: 'bronze',
            pin: type === 'phone' ? secret : null,
            password: type === 'email' ? secret : null
        };

        const { data, error } = await supabase.from('customers').insert(newUser).select().single();
        if (error) throw error;

        res.json({ success: true, user: data });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}