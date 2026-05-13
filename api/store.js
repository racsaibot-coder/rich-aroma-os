const { supabase } = require('./lib/supabase');

// Egress Optimization: Menu Cache (2 minutes)
let menuCache = null;
let lastMenuFetch = 0;
const MENU_CACHE_TTL = 120 * 1000;

const HONDURAS_TZ = 'America/Tegucigalpa';

function getHondurasDate() {
    try {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: HONDURAS_TZ, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());
    } catch(e) {
        return new Date().toISOString().split('T')[0];
    }
}

// --- LOYALTY HELPERS ---
async function awardPoints(customerId, amount, supabase) {
    if (!customerId || amount <= 0) return;
    try {
        const { data: customer } = await supabase.from('customers').select('points').eq('id', customerId).single();
        if (!customer) return;
        
        const newPoints = (parseInt(customer.points) || 0) + Math.floor(parseFloat(amount));
        
        await supabase.from('customers')
            .update({ 
                points: newPoints,
                visits: supabase.rpc('increment_visits') // We'll use a direct update if RPC fails
            })
            .eq('id', customerId);
            
        // Fallback for visits if RPC isn't setup
        const { data: c2 } = await supabase.from('customers').select('visits').eq('id', customerId).single();
        await supabase.from('customers').update({ visits: (parseInt(c2.visits) || 0) + 1 }).eq('id', customerId);

    } catch (e) { console.error("Award Points Fail:", e); }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id } = req.query;

    try {
        // --- 1. MENU (Egress Optimized) ---
        if (action === 'menu' && req.method === 'GET') {
            const isAdmin = req.query.admin === 'true';
            const resId = req.query.restaurantId || 'rich-aroma';
            const now = Date.now();

            if (!isAdmin && resId === 'rich-aroma' && menuCache && (now - lastMenuFetch < MENU_CACHE_TTL)) {
                return res.json(menuCache);
            }
            
            const [rItems, rModGroups, rModOptions, rItemModGroups] = await Promise.all([
                supabase.from('menu_items')
                    .select('id, name, price, available, image_url, category, base_recipe, restaurant_id')
                    .eq('restaurant_id', resId)
                    .order('name'),
                supabase.from('modifier_groups').select('id, name, restaurant_id').eq('restaurant_id', resId),
                supabase.from('modifier_options').select('id, name, price, group_id, is_default, price_adjustment').order('name'),
                supabase.from('item_modifier_groups').select('menu_item_id, modifier_group_id')
            ]);

            const filteredItems = (rItems.data || []).filter(i => isAdmin || i.available !== false);

            const categoryMeta = {
                combos: { name: 'Combos', icon: '🔥' },
                calientes: { name: 'Calientes', icon: '☕' },
                heladas: { name: 'Heladas', icon: '🥤' },
                comida: { name: 'Comida', icon: '🥐' },
                drinks: { name: 'Bebidas', icon: '🥤' },
                coffee: { name: 'Café', icon: '☕' }
            };

            const grouped = {};
            filteredItems.forEach(item => {
                const rawCat = (item.category || 'otros').toLowerCase();
                if (!grouped[rawCat]) grouped[rawCat] = [];
                grouped[rawCat].push({
                    id: item.id,
                    name: item.name,
                    price: parseFloat(item.price) || 0,
                    available: item.available,
                    image_url: item.image_url,
                    category: rawCat,
                    base_recipe: item.base_recipe
                });
            });

            const categories = Object.keys(grouped).map(catId => ({
                id: catId,
                name: categoryMeta[catId]?.name || (catId.charAt(0).toUpperCase() + catId.slice(1)),
                items: grouped[catId]
            }));

            const responseData = { 
                items: filteredItems, 
                categories,
                modGroups: rModGroups.data || [], 
                modOptions: rModOptions.data || [], 
                itemModGroups: rItemModGroups.data || [],
                taxRate: 0.00 
            };

            if (!isAdmin && resId === 'rich-aroma') {
                menuCache = responseData;
                lastMenuFetch = now;
            }

            return res.json(responseData);
        }

        // --- 2. ORDERS GET (Egress Optimized) ---
        if (action === 'orders' && req.method === 'GET') {
            const timeLimit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, created_at, status, total, items, payment_method, customer_id, restaurant_id, customers(name, phone)')
                .gte('created_at', timeLimit)
                .in('status', ['pending', 'paid', 'preparing', 'ready', 'completed', 'drinks_ready', 'food_ready', 'cancelled'])
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json({ orders: data || [] });
        }

        // --- 3. CUSTOMER LOOKUP ---
        if (action === 'customer_by_phone' && req.method === 'GET') {
            const { query } = req.query;
            const { data: customer } = await supabase.from('customers').select('*').eq('phone', query).maybeSingle();
            return res.json(customer || { id: null });
        }

        // --- 4. CREATE ORDER (With Loyalty Award) ---
        if (req.method === 'POST' && !action) {
            const { items, total, paymentMethod, customerId, notes, fulfillment } = req.body;
            
            const { data, error } = await supabase.from('orders').insert({
                items, total, 
                payment_method: paymentMethod, 
                customer_id: customerId, 
                notes, 
                fulfillment,
                status: 'pending',
                restaurant_id: 'rich-aroma'
            }).select().single();
            
            if (error) throw error;

            // AWARD POINTS INSTANTLY
            if (customerId) {
                await awardPoints(customerId, total, supabase);
            }

            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
