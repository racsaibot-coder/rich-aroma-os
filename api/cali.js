const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') return res.status(200).end();

        const { action, id } = req.query;

        // 1. GET PRODUCTS
        if (req.method === 'GET' && action === 'products') {
            const { data, error } = await supabase.from('cali_products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data || []);
        }

        // 2. GET LOCATIONS
        if (req.method === 'GET' && action === 'locations') {
            const { data, error } = await supabase.from('cali_locations').select('*').eq('active', true).order('name');
            if (error) throw error;
            return res.json(data || []);
        }

        // 3. ADMIN CHECK
        const auth = req.headers.authorization;
        const isAdmin = auth && (auth.includes('EMP-admin') || auth.includes('TEST_TOKEN_ADMIN'));

        // 4. PRODUCT MANAGEMENT
        if (action === 'products' && (req.method === 'POST' || (req.method === 'PUT' && id))) {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

            const { imageBase64, ...productData } = req.body;
            
            // Image Upload Logic
            if (imageBase64 && imageBase64.startsWith('data:image')) {
                try {
                    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                    const buffer = Buffer.from(base64Data, 'base64');
                    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
                    const ext = mimeType.split('/')[1] || 'png';
                    const storagePath = `cali_products/PROD_${id || Date.now()}_${Date.now()}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                        .from('menu-images')
                        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(storagePath);
                        productData.image_url = publicUrl;
                    }
                } catch (err) {
                    console.error("Image upload failed:", err);
                }
            }

            let result;
            if (req.method === 'POST') {
                result = await supabase.from('cali_products').insert(productData).select().single();
            } else {
                result = await supabase.from('cali_products').update(productData).eq('id', id).select().single();
            }

            if (result.error) throw result.error;
            return res.json(result.data);
        }

        // 5. LOCATION MANAGEMENT
        if (action === 'locations' && (req.method === 'POST' || (req.method === 'PUT' && id))) {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            let result;
            if (req.method === 'POST') {
                result = await supabase.from('cali_locations').insert(req.body).select().single();
            } else {
                result = await supabase.from('cali_locations').update(req.body).eq('id', id).select().single();
            }
            if (result.error) throw result.error;
            return res.json(result.data);
        }

        // 6. ORDERS (Admin)
        if (req.method === 'GET' && action === 'orders') {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { data, error } = await supabase.from('cali_orders').select('*, cali_locations(name, city), cali_products(name)').order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data || []);
        }

        // 7. UPDATE ORDER
        if (req.method === 'PATCH' && action === 'update_order' && id) {
            const { data, error } = await supabase.from('cali_orders').update(req.body).eq('id', id).select().single();
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Cali API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
