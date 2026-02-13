// api/admin/founders.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        const { data: founders } = await supabase
            .from('founders')
            .select('*')
            .order('created_at', { ascending: false });
            
        const confirmed = (founders || []).filter(f => f.status === 'confirmed');
        const pending = (founders || []).filter(f => f.status === 'pending');
        
        return res.json({
            sold: confirmed.length,
            revenue: confirmed.length * 1500,
            pending,
            confirmed
        });
    }

    // Add Founder manually
    if (req.method === 'POST') {
        const { name, phone, ref, status } = req.body;
        
        // Count
        const { count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
        const ticket = 'RA-F' + ((count || 0) + 1).toString().padStart(3, '0');
        
        const { data, error } = await supabase.from('founders').insert({
            name,
            phone: phone.replace(/\D/g, ''),
            ticket,
            ref_notes: ref || 'CASH',
            status: status || 'pending',
            amount: 1500
        }).select().single();
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, entry: data });
    }

    res.status(405).json({ error: 'Method Not Allowed' });
}