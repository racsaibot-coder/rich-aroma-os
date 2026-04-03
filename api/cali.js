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

        if (action === 'ping') {
            return res.json({ status: 'ok', time: new Date().toISOString(), message: 'Artisan API is live' });
        }
        
        // Auth Check
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token === 'TEST_TOKEN_ADMIN' || token.startsWith('EMP-')) {
                isAdmin = true;
            } else {
                // In a real app, verify Supabase token
                // For this prototype, we'll allow EMP- tokens as admin
                if (token.startsWith('EMP-')) isAdmin = true;
            }
        }

        // --- PUBLIC ROUTES ---
        
        // GET Products
        if (req.method === 'GET' && action === 'products') {
            const { data, error } = await supabase.from('cali_products').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error("Supabase Products Error:", error);
                throw error;
            }
            return res.json(data || []);
        }
        
        // GET Locations
        if (req.method === 'GET' && action === 'locations') {
            const { data, error } = await supabase.from('cali_locations').select('*').eq('active', true);
            if (error) {
                console.error("Supabase Locations Error:", error);
                throw error;
            }
            return res.json(data || []);
        }

        // POST Submit Order (Public)
        if (req.method === 'POST' && action === 'submit_order') {
            const { data, error } = await supabase.from('cali_orders').insert(req.body).select().single();
            if (error) throw error;
            return res.json(data);
        }

        // --- ADMIN ROUTES ---
        if (!isAdmin) {
            return res.status(401).json({ error: 'Unauthorized: Admin required' });
        }

        // Manage Products
        if (action === 'products' && req.method === 'POST') {
            const { imageBase64, ...productData } = req.body;
            
            if (imageBase64) {
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
                const ext = mimeType.split('/')[1] || 'png';
                const storagePath = `cali_products/PROD_${Date.now()}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(storagePath);
                    productData.image_url = publicUrl;
                }
            }

            const { data, error } = await supabase.from('cali_products').insert(productData).select().single();
            if (error) throw error;
            return res.json(data);
        }
        
        if (action === 'products' && id && req.method === 'PUT') {
            const { imageBase64, ...updates } = req.body;

            if (imageBase64) {
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
                const ext = mimeType.split('/')[1] || 'png';
                const storagePath = `cali_products/PROD_${id}_${Date.now()}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(storagePath);
                    updates.image_url = publicUrl;
                }
            }

            const { data, error } = await supabase.from('cali_products').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return res.json(data);
        }
        
        if (action === 'products' && id && req.method === 'DELETE') {
            const { error } = await supabase.from('cali_products').delete().eq('id', id);
            if (error) throw error;
            return res.json({ success: true });
        }

        // Manage Locations
        if (action === 'locations' && req.method === 'POST') {
            const { data, error } = await supabase.from('cali_locations').insert(req.body).select().single();
            if (error) throw error;
            return res.json(data);
        }
        
        if (action === 'locations' && id && req.method === 'PUT') {
            const { data, error } = await supabase.from('cali_locations').update(req.body).eq('id', id).select().single();
            if (error) throw error;
            return res.json(data);
        }
        
        if (action === 'locations' && id && req.method === 'DELETE') {
            const { error } = await supabase.from('cali_locations').delete().eq('id', id);
            if (error) throw error;
            return res.json({ success: true });
        }

        // GET Orders (Admin)
        if (req.method === 'GET' && action === 'orders') {
            const { data, error } = await supabase
                .from('cali_orders')
                .select('*, cali_locations(name, city), cali_products(name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }

        // Update Order (Admin or Receipt Upload)
        if (action === 'update_order' && id && req.method === 'PATCH') {
            const { imageBase64, ...updates } = req.body;
            
            // Handle Receipt Upload (Publicly allowed if id matches)
            if (req.body.action === 'upload_receipt' && imageBase64) {
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
                const ext = mimeType.split('/')[1] || 'png';
                const storagePath = `cali_receipts/ORD_${id}_${Date.now()}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('menu-images')
                    .getPublicUrl(storagePath);
                
                const { data, error } = await supabase
                    .from('cali_orders')
                    .update({ payment_proof_url: publicUrl })
                    .eq('id', id)
                    .select().single();
                if (error) throw error;
                return res.json(data);
            }

            // Standard Update (Requires Admin)
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { data, error } = await supabase.from('cali_orders').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action Not Found' });
    } catch (error) {
        console.error("Cali API Error:", error);
        return res.status(500).json({ error: error.message, stack: error.stack, detail: error });
    }
};
