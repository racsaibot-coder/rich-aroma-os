// api/live/status.js
// NOTE: Vercel functions are stateless. We cannot use `let currentDrop = ...` in memory.
// We must fetch the status from the Database (or Edge Config/Redis) every time.
// For now, we will fetch from a 'system_state' table in Supabase.

const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Fetch 'live_drop_config' from a settings table
        // We'll assume a table 'system_settings' with key 'live_drop'
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'live_drop')
            .single();

        if (error || !data) {
            // Default Fallback if DB not set up yet
            return res.json({
                active: false,
                product: "Mystery Item",
                price: 0,
                stock: 0
            });
        }

        res.status(200).json(data.value);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}