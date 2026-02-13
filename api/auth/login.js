// api/auth/login.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { identifier, secret, type } = req.body;

    try {
        let user;
        if (type === 'phone') {
            const phone = identifier.replace(/\D/g, '');
            const { data } = await supabase.from('customers').select('*').eq('phone', phone).single();
            
            if (!data || data.pin !== secret) return res.status(401).json({ error: 'Invalid credentials' });
            user = data;
        } else {
            const email = identifier.toLowerCase();
            const { data } = await supabase.from('customers').select('*').eq('email', email).single();
            
            if (!data || data.password !== secret) return res.status(401).json({ error: 'Invalid credentials' });
            user = data;
        }

        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
}