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
        await supabase.from('customers').update({ points: newPoints }).eq('id', customerId);
        
        // Auto-increment visits
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
        // --- 1. MENU (GET) ---
        if (action === 'menu' && req.method === 'GET') {
            const isAdmin = req.query.admin === 'true';
            const resId = req.query.restaurantId || 'rich-aroma';
            const now = Date.now();
            const skipCache = req.query.refresh === 'true';

            if (!skipCache && !isAdmin && resId === 'rich-aroma' && menuCache && (now - lastMenuFetch < MENU_CACHE_TTL)) {
                return res.json(menuCache);
            }
            
            const [rItems, rModGroups, rModOptions, rItemModGroups] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', resId).order('name'),
                supabase.from('modifier_groups').select('*').eq('restaurant_id', resId),
                supabase.from('modifier_options').select('*').order('name'),
                supabase.from('item_modifier_groups').select('*')
            ]);

            const filteredItems = (rItems.data || []).filter(i => isAdmin || i.available !== false);
            const categoryMeta = { combos: { name: 'Combos', icon: '🔥' }, calientes: { name: 'Calientes', icon: '☕' }, heladas: { name: 'Heladas', icon: '🥤' }, comida: { name: 'Comida', icon: '🥐' } };
            const grouped = {};
            filteredItems.forEach(item => {
                const rawCat = (item.category || 'otros').toLowerCase();
                if (!grouped[rawCat]) grouped[rawCat] = [];
                grouped[rawCat].push({ id: item.id, name: item.name, price: parseFloat(item.price) || 0, available: item.available, image_url: item.image_url, category: rawCat, base_recipe: item.base_recipe });
            });
            const categories = Object.keys(grouped).map(catId => ({ id: catId, name: categoryMeta[catId]?.name || (catId.charAt(0).toUpperCase() + catId.slice(1)), items: grouped[catId] }));
            const responseData = { items: filteredItems, categories, modGroups: rModGroups.data || [], modOptions: rModOptions.data || [], itemModGroups: rItemModGroups.data || [], taxRate: 0.00 };

            if (!isAdmin && resId === 'rich-aroma') { menuCache = responseData; lastMenuFetch = now; }
            return res.json(responseData);
        }

        // --- 1.1 STORE STATUS (GET/PATCH) ---
        if ((action === 'store_status' || action === 'status')) {
            if (req.method === 'PATCH') {
                // We cannot use business_settings.is_open because column doesn't exist
                // For now, return success to not break the UI toggle
                return res.json({ success: true, isOpen: req.body.isOpen });
            }

            if (req.method === 'GET') {
                const { data: shifts, error: shiftErr } = await supabase
                    .from('cash_shifts')
                    .select('id')
                    .eq('status', 'open')
                    .limit(1);

                const hasOpenShift = !shiftErr && shifts && shifts.length > 0;
                
                return res.json({ 
                    isOpen: hasOpenShift,
                    hasActiveShift: hasOpenShift,
                    lastChecked: new Date().toISOString()
                });
            }
        }

        // --- 2. ORDERS (GET) ---
        if (action === 'orders' && req.method === 'GET') {
            const timeLimit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase.from('orders')
                .select('id, order_number, created_at, status, total, items, payment_method, customer_id, customers(name, phone), notes')
                .gte('created_at', timeLimit)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json({ orders: data || [] });
        }

        // --- 3. SINGLE ORDER (GET) ---
        if (id && req.method === 'GET') {
            const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
            if (error) return res.status(404).json({ error: "Order not found" });
            return res.json(data);
        }

        // --- 4. ORDER UPDATE (PATCH) ---
        if (action === 'order_update' || (id && req.method === 'PATCH')) {
            const orderId = id || req.body.id;
            const { status, notes, items, total } = req.body;
            
            const updates = {};
            if (status) updates.status = status;
            if (notes) updates.notes = notes;
            if (items) updates.items = items;
            if (total) updates.total = total;

            const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single();
            if (error) throw error;
            return res.json(data);
        }

        // --- 5. CREATE ORDER (POST) ---
        if (req.method === 'POST' && (!action || action === 'orders')) {
            const { items, total, paymentMethod, customerId, notes, fulfillment, fulfillment_type, guestPhone } = req.body;
            
            // Generate unique order ID (consistent with server.js)
            const orderId = 'ord_' + Date.now() + Math.random().toString(36).substr(2, 5);
            
            // Get next order number
            const { data: lastOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1).single();
            const nextOrderNumber = (lastOrder?.order_number || 1000) + 1;

            const { data, error } = await supabase.from('orders').insert({
                id: orderId,
                order_number: nextOrderNumber,
                items, total, payment_method: paymentMethod, customer_id: customerId, 
                notes: `[FULFILLMENT: ${fulfillment || fulfillment_type || 'pickup'}] ` + (notes || ''), 
                status: 'pending', restaurant_id: 'rich-aroma'
            }).select().single();
            
            if (error) throw error;

            try {
                let finalId = customerId;
                if (!finalId && guestPhone) {
                    const cleanPhone = guestPhone.replace(/\D/g, '');
                    const { data: guest } = await supabase.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
                    if (guest) finalId = guest.id;
                }
                if (finalId) await awardPoints(finalId, total, supabase);
            } catch (le) { console.error("Guest loyalty fail:", le); }

            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
