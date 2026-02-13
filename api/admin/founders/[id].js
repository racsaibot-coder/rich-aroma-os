// api/admin/founders/[id].js
// Handling DELETE /api/admin/founders/:id

const { supabase } = require('../../lib/supabase');

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'DELETE') return res.status(405).end();

    const { id } = req.query; // Vercel passes dynamic route params in query

    const { error } = await supabase
        .from('founders')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, message: "Request rejected/deleted." });
}