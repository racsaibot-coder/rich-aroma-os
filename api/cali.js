const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
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

        // 3. VALIDATE PROMO CODE
        if (req.method === 'GET' && action === 'validate_promo') {
            const { code } = req.query;
            if (!code) return res.status(400).json({ error: 'Code required' });
            
            const { data: seller, error } = await supabase
                .from('customers')
                .select('id, name, referral_code')
                .eq('referral_code', code.toUpperCase())
                .contains('tags', ['cali_seller'])
                .single();
            
            if (error || !seller) return res.status(404).json({ error: 'Invalid or inactive promo code' });
            return res.json({ success: true, seller_name: seller.name, discount_percent: 5 });
        }

        // 4. ADMIN CHECK
        const auth = req.headers.authorization;
        const isAdmin = auth && (auth.includes('EMP-admin') || auth.includes('TEST_TOKEN_ADMIN') || auth.includes('Bearer 3620'));

        // 5. SELLERS MANAGEMENT
        if (action === 'sellers' && req.method === 'GET') {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, referral_code, tags')
                .contains('tags', ['cali_seller'])
                .order('name');
            if (error) throw error;
            return res.json(data || []);
        }

        if (action === 'add_seller' && req.method === 'POST') {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { name, phone, code } = req.body;
            
            // 1. Check if customer exists (use maybeSingle to avoid errors if not found)
            const { data: existing, error: findError } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', phone)
                .maybeSingle();
            
            if (findError) throw findError;
            
            if (existing) {
                // Update existing customer
                let newTags = Array.isArray(existing.tags) ? existing.tags : [];
                if (!newTags.includes('cali_seller')) newTags.push('cali_seller');
                
                const { data, error } = await supabase
                    .from('customers')
                    .update({ 
                        referral_code: code.toUpperCase(), 
                        tags: newTags 
                    })
                    .eq('id', existing.id)
                    .select().single();
                
                if (error) throw error;
                return res.json(data);
            } else {
                // Create new customer as seller
                // Generate a safer ID
                const { data: maxCust } = await supabase.from('customers').select('id').order('created_at', { ascending: false }).limit(1);
                const nextId = 'C' + (Math.floor(Math.random() * 900) + 100);

                const { data, error } = await supabase
                    .from('customers')
                    .insert({ 
                        id: nextId,
                        name, 
                        phone, 
                        referral_code: code.toUpperCase(), 
                        tags: ['cali_seller']
                    })
                    .select().single();
                
                if (error) throw error;
                return res.json(data);
            }
        }

        // 6. SUBSCRIPTIONS (Admin)
        if (action === 'subscriptions' && req.method === 'GET') {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { data, error } = await supabase
                .from('cali_subscriptions')
                .select('*, cali_locations(name, city)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data || []);
        }

        // 7. PRODUCT MANAGEMENT
        if (action === 'products' && (req.method === 'POST' || (req.method === 'PUT' && id))) {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

            const { imageBase64, ...productData } = req.body;
            
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
        if (action === 'locations' && (req.method === 'POST' || (req.method === 'PUT' && id) || (req.method === 'DELETE' && id))) {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            let result;
            if (req.method === 'POST') {
                result = await supabase.from('cali_locations').insert(req.body).select().single();
            } else if (req.method === 'PUT') {
                result = await supabase.from('cali_locations').update(req.body).eq('id', id).select().single();
            } else if (req.method === 'DELETE') {
                result = await supabase.from('cali_locations').delete().eq('id', id);
            }
            if (result.error) throw result.error;
            return res.json(result.data || { success: true });
        }

        // 6. ORDERS (Admin)
        if (req.method === 'GET' && action === 'orders') {
            if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
            const { data, error } = await supabase.from('cali_orders').select('*, cali_locations(name, city)').order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data || []);
        }

        // 7. UPDATE ORDER
        if (req.method === 'PATCH' && action === 'update_order' && id) {
            const updates = req.body;
            
            // Handle Automatic Refunds if status is changed to rejected
            if (updates.status === 'rejected' || updates.payment_status === 'rejected') {
                try {
                    // 1. Get the existing order to find Stripe info
                    const { data: order } = await supabase.from('cali_orders').select('*').eq('id', id).single();
                    
                    if (order && (order.status === 'paid' || order.status === 'confirmed')) {
                        // 2. Look for Stripe Session ID in notes
                        const sessionMatch = order.notes?.match(/Stripe Session: (cs_[a-zA-Z0-9_]+)/);
                        const sessionId = sessionMatch ? sessionMatch[1] : null;

                        if (sessionId && process.env.STRIPE_SECRET_KEY) {
                            console.log(`[Refund] Initiating refund for session: ${sessionId}`);
                            const session = await stripe.checkout.sessions.retrieve(sessionId);
                            if (session.payment_intent) {
                                await stripe.refunds.create({
                                    payment_intent: session.payment_intent,
                                    reason: 'requested_by_customer'
                                });
                                updates.status = 'refunded';
                                updates.notes = (order.notes || '') + `\n[REFUNDED] Automatically processed via Admin Reject.`;
                            }
                        }
                    }
                } catch (refundErr) {
                    console.error("Refund failed:", refundErr.message);
                    updates.notes = (updates.notes || '') + `\n[REFUND ERROR] ${refundErr.message}`;
                }
            }

            const { data, error } = await supabase.from('cali_orders').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Cali API Error:", e);
        res.status(500).send(e.message);
    }
};
