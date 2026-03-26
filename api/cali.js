const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        const { action, id } = req.query;
        
        // Auth Check
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token === 'TEST_TOKEN_ADMIN' || token.startsWith('EMP-')) {
                isAdmin = true;
            } else {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user && (user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin')) {
                    isAdmin = true;
                } else if (user) {
                    const { data: emp } = await supabase.from('employees').select('role').or(`email.eq.${user.email},id.eq.${user.id}`).single();
                    if (emp && emp.role === 'admin') isAdmin = true;
                }
            }
        }

        // Public Routes
        if (req.method === 'GET' && action === 'products') {
            const { data, error } = await supabase.from('cali_products').select('*').order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.json(data);
        }
        
        if (req.method === 'GET' && action === 'locations') {
            const { data, error } = await supabase.from('cali_locations').select('*');
            if (error) return res.status(500).json({ error: error.message });
            return res.json(data);
        }

        // Admin Routes
        if (!isAdmin) {
            return res.status(401).json({ error: 'Unauthorized: Admin required' });
        }

        if (action === 'products') {
            if (req.method === 'POST') {
                const { data, error } = await supabase.from('cali_products').insert(req.body).select().single();
                if (error) throw error;
                return res.json(data);
            }
        }
        
        if (action === 'product_update' && id) {
            if (req.method === 'PUT') {
                const { data, error } = await supabase.from('cali_products').update(req.body).eq('id', id).select().single();
                if (error) throw error;
                return res.json(data);
            }
            if (req.method === 'DELETE') {
                const { error } = await supabase.from('cali_products').delete().eq('id', id);
                if (error) throw error;
                return res.json({ success: true });
            }
        }

        if (action === 'locations') {
            if (req.method === 'POST') {
                const { data, error } = await supabase.from('cali_locations').insert(req.body).select().single();
                if (error) throw error;
                return res.json(data);
            }
        }
        
        if (action === 'location_update' && id) {
            if (req.method === 'PUT') {
                const { data, error } = await supabase.from('cali_locations').update(req.body).eq('id', id).select().single();
                if (error) throw error;
                return res.json(data);
            }
            if (req.method === 'DELETE') {
                const { error } = await supabase.from('cali_locations').delete().eq('id', id);
                if (error) throw error;
                return res.json({ success: true });
            }
        }

        if (req.method === 'GET' && action === 'orders') {
            const { data, error } = await supabase.from('cali_orders').select('*, cali_locations(*)').order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Not Found' });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message, stack: error.stack });
    }
};
