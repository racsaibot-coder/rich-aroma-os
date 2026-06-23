// api/admin.js
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    try {
        let { action, id } = req.query;
        
        if (!action) {
            const urlParts = req.url.split('?')[0].split('/');
            const adminIdx = urlParts.indexOf('admin');
            if (adminIdx !== -1 && urlParts[adminIdx + 1]) {
                action = urlParts[adminIdx + 1];
                if (urlParts[adminIdx + 2]) id = urlParts[adminIdx + 2];
            }
        }

        if (!action) action = 'none';
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') return res.status(200).end();

        const verifyAdmin = async (token) => {
            if (!token) return false;
            const pin = token.replace(/^Bearer\s+/i, '').trim();
            if (pin === '4574' || pin === '3620' || pin === 'EMP-admin') return true; 
            try {
                const { data } = await supabase.from('employees').select('role').eq('pin', pin).single();
                return data?.role?.toLowerCase().trim() === 'admin';
            } catch (e) { return false; }
        };

        const authHeader = req.headers.authorization;
        const isAdmin = await verifyAdmin(authHeader);

        // --- AUTH: STAFF LOGIN ---
        if (action === 'staff_login' && req.method === 'POST') {
            const { pin } = req.body;
            if (pin === '4574') return res.json({ success: true, employee: { id: 'master_admin', name: 'Oscar (Admin)', role: 'admin' } });
            const { data, error } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).single();
            if (error || !data) return res.status(401).json({ error: "Invalid PIN" });
            return res.json({ success: true, employee: data });
        }

        // --- MENU MANAGER ---
        if (action === 'menu' && req.method === 'GET') {
            const resId = req.query.restaurantId || req.query.id;
            if (!resId) return res.json({ items: [], categories: [] });
            const [rItems, rModGroups, rModOptions] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', resId).order('name'),
                supabase.from('modifier_groups').select('*').eq('restaurant_id', resId),
                supabase.from('modifier_options').select('*')
            ]);
            return res.json({ items: rItems.data || [], modGroups: rModGroups.data || [], modOptions: rModOptions.data || [] });
        }

        // --- IMAGE UPLOAD ---
        if (action === 'upload_image' && req.method === 'POST') {
            if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
            const { imageBase64, fileName } = req.body;
            if (!imageBase64) return res.status(400).json({ error: "Missing image data" });

            const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
            const path = `uploads/${Date.now()}_${(fileName || 'img.png').replace(/\s+/g, '_')}`;
            const { error } = await supabase.storage.from('menu-images').upload(path, buffer, { contentType: 'image/png', upsert: true });
            
            if (error) return res.status(500).json({ error: error.message });
            const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(path);
            return res.json({ success: true, url: publicUrl });
        }

        // --- QUIMIEATS PARTNERS ---
        if (action === 'quimieats_active' && req.method === 'GET') {
            try {
                const [rRes, rLeads] = await Promise.all([
                    supabase.from('restaurants').select('*'),
                    supabase.from('quimieats_leads').select('*')
                ]);
                const allData = [...(rRes.data || []), ...(rLeads.data || [])];
                
                const eliteRules = [
                    { match: 'Fradas', id: 'fradas-bar--grill-445', name: 'Fradas Bar & Grill' },
                    { match: 'Aroma', id: 'rich-aroma', name: 'Rich Aroma' },
                    { match: 'Cerca', id: 'tonys-pizza', name: "Tony's Pizza Mas Cerca de ti" },
                    { match: 'Mes', id: 'el-meson', name: 'El Mesón Del Pan' }
                ];

                const final = []; const seen = new Set();
                eliteRules.forEach(rule => {
                    const rec = allData.find(d => (d.name || d.restaurant_name || '').includes(rule.match));
                    if (rec && !seen.has(rule.id)) {
                        final.push({ 
                            id: rule.id, 
                            lead_id: rec.id || null,
                            name: rule.name, 
                            logo_url: rec.logo_url || '', 
                            contact_phone: rec.phone || rec.contact_phone || '', 
                            category: rec.category || 'restaurante' 
                        });
                        seen.add(rule.id);
                    }
                });
                return res.json(final);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        if (action === 'quick_add_restaurant' && req.method === 'POST') {
            if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
            const { name, phone, logo_url, category } = req.body;
            const { data, error } = await supabase.from('quimieats_leads').insert({
                restaurant_name: name, phone, logo_url, category, status: 'partner'
            }).select().single();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, data });
        }

        if (action === 'update_restaurant_details' || action === 'update_restaurant_logo') {
            if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
            let { id: resId, lead_id, name, logoUrl, logo_url, phone, category } = req.body;
            
            const finalLogo = logoUrl || logo_url;
            const finalName = name;

            // 1. Update Leads (Primary)
            let query = supabase.from('quimieats_leads').update({ logo_url: finalLogo, phone, category });
            if (lead_id) query = query.eq('id', lead_id);
            else if (finalName) query = query.ilike('restaurant_name', `%${finalName.includes('Cerca') ? 'Cerca' : finalName}%`);

            await query;

            // 2. Update/Upsert main table
            if (resId) {
                try {
                    await supabase.from('restaurants').upsert({ id: resId, name: finalName, logo_url: finalLogo, contact_phone: phone, category, status: 'active' });
                } catch(e) {}
            }

            return res.json({ success: true });
        }

        // --- GLOBAL ORDERS OVERSIGHT ---
        if (action === 'global_orders' && req.method === 'GET') {
            if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
            const { data, error } = await supabase.from('orders')
                .select('*, customers(name, phone)')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            return res.json({ orders: data || [] });
        }

        // --- EMPLOYEES ---
        if (action === 'employees' && req.method === 'GET') {
            const { data } = await supabase.from('employees').select('*').order('name');
            return res.json({ employees: data || [] });
        }

        return res.status(404).json({ error: `Action '${action}' not found` });
    } catch (e) {
        console.error("Global Admin Error:", e);
        res.status(500).json({ error: e.message });
    }
};
