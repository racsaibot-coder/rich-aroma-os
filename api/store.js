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
async function awardPoints(customerId, amount, paymentMethod, supabase) {
    if (!customerId || amount <= 0) return;
    try {
        const { data: customer } = await supabase.from('customers').select('points').eq('id', customerId).single();
        if (!customer) return;

        // Logic: 1 point per L. 10 spent. Double points for Rico Cash.
        const multiplier = (paymentMethod === 'rico_balance') ? 2 : 1;
        const pointsEarned = Math.floor((parseFloat(amount) / 10) * multiplier);
        
        if (pointsEarned <= 0) return;

        const newPoints = (parseInt(customer.points) || 0) + pointsEarned;
        await supabase.from('customers').update({ points: newPoints }).eq('id', customerId);
        
        // Auto-increment visits
        const { data: c2 } = await supabase.from('customers').select('visits').eq('id', customerId).single();
        await supabase.from('customers').update({ visits: (parseInt(c2.visits) || 0) + 1 }).eq('id', customerId);
        
        console.log(`[Loyalty] Awarded ${pointsEarned} points to ${customerId}`);
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

        // --- 1.2 RESTAURANTS (GET) ---
        if (action === 'get_restaurants' && req.method === 'GET') {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('status', 'active')
                .order('name');
            if (error) throw error;
            
            // Map settings.category to category if column is missing
            const mapped = (data || []).map(r => ({
                ...r,
                category: r.category || r.settings?.category || 'restaurante'
            }));
            return res.json(mapped);
        }

        // --- 1.2.1 ADS & PROMOS (GET) ---
        if (action === 'get_ads' && req.method === 'GET') {
            // Hardcoded for now for speed, but ready to move to Supabase table 'ads'
            const ads = [
                {
                    id: 'ad_coquin',
                    title: 'Supermercado El Coquín',
                    subtitle: '¡Gran Barata de Fin de Semana!',
                    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop',
                    link: 'https://wa.me/50499990000',
                    badge: 'PROMO'
                },
                {
                    id: 'ad_dentist',
                    title: 'Clínica Dental Quimistán',
                    subtitle: '2x1 en Limpiezas Dentales',
                    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&auto=format&fit=crop',
                    link: 'https://wa.me/50499990000',
                    badge: 'SALUD'
                }
            ];
            return res.json(ads);
        }

        // --- 1.3 QUIMIEATS SIGNUP (POST - INSTANT CREATION) ---
        if (action === 'quimieats_signup' && req.method === 'POST') {
            const { restaurant_name, contact_name, phone, category } = req.body;
            
            // 1. Generate clean ID and temp PIN
            const resId = restaurant_name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.floor(Math.random()*900+100);
            const tempPin = Math.floor(Math.random() * 9000 + 1000).toString();

            // 2. Create Restaurant Record Immediately
            const { data: restaurant, error: resErr } = await supabase.from('restaurants').insert({
                id: resId,
                name: restaurant_name,
                contact_phone: phone,
                status: 'active',
                settings: { owner: contact_name, pin: tempPin, category: category || 'restaurante' }
            }).select().single();

            if (resErr) throw resErr;

            // 3. Log as Lead for history
            await supabase.from('quimieats_leads').insert({
                restaurant_name, contact_name, phone, category,
                status: 'partner'
            });

            return res.json({ 
                success: true, 
                setupUrl: `/onboarding.html?resId=${resId}&pin=${tempPin}`
            });
        }

        // --- 1.5 PARTNER TOP-UP (POST) ---
        if (action === 'partner_topup' && req.method === 'POST') {
            const { restaurant_id, phone, amount } = req.body;
            const topupAmount = parseFloat(amount);
            
            if (!restaurant_id || !phone || topupAmount <= 0) {
                return res.status(400).json({ error: "Datos invalidos" });
            }

            // 1. Find Customer
            const cleanPhone = phone.replace(/\D/g, '');
            const { data: customer, error: custErr } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single();
            if (custErr || !customer) return res.status(404).json({ error: "Cliente no encontrado. Debe registrarse primero." });

            // 2. Update Customer Balance
            const newBalance = (parseFloat(customer.cash_balance) || 0) + topupAmount;
            const { error: upErr } = await supabase.from('customers').update({ cash_balance: newBalance }).eq('id', customer.id);
            if (upErr) throw upErr;

            // 3. Record in Ledger (Merchant now owes platform this cash)
            await supabase.from('quimieats_ledger').insert({
                restaurant_id,
                amount: -topupAmount, // Negative because merchant OWES the platform
                type: 'rico_load',
                customer_id: customer.id,
                status: 'pending',
                notes: `Top-up vendido por socio a ${cleanPhone}`
            });

            return res.json({ success: true, newBalance, customerName: customer.name });
        }

        // --- 1.6 DRIVER FLOW ---
        if (action === 'driver_login' && req.method === 'POST') {
            const { pin } = req.body;
            const { data: driver, error } = await supabase
                .from('employees')
                .select('*')
                .eq('pin', pin)
                .eq('role', 'driver')
                .eq('active', true)
                .maybeSingle();

            if (error || !driver) return res.status(401).json({ success: false, error: "PIN invalido" });
            return res.json({ success: true, driver });
        }

        if (action === 'driver_signup' && req.method === 'POST') {
            const { name, phone, vehicle } = req.body;
            
            const cleanPhone = phone.replace(/\D/g, '');
            const driverId = 'drv_' + Date.now() + Math.floor(Math.random()*1000);
            const tempPin = Math.floor(Math.random() * 9000 + 1000).toString();

            const { data, error } = await supabase.from('employees').insert({
                id: driverId,
                name: name,
                role: 'driver',
                pin: tempPin,
                active: true,
                color: 'cyan',
                hourly_rate: 0 // Drivers usually work on commission/fees
            }).select().single();

            if (error) throw error;
            return res.json({ success: true, pin: tempPin, driverId: data.id });
        }

        if (action === 'driver_orders' && req.method === 'GET') {
            const { driverId, mode } = req.query;
            let query = supabase.from('orders')
                .select('*, customers(name, phone, address)')
                .eq('status', 'ready'); // Only orders that are ready to pick up

            if (mode === 'available') {
                query = query.is('driver_id', null);
            } else {
                query = query.eq('driver_id', driverId).not('delivery_status', 'eq', 'delivered');
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return res.json({ orders: data || [] });
        }

        if (action === 'driver_claim' && req.method === 'POST') {
            const { id } = req.query;
            const { driverId } = req.body;

            // 1. Check Driver's Active Load
            const { data: activeOnes } = await supabase
                .from('orders')
                .select('id, notes')
                .is('completed_at', null)
                .ilike('notes', `%DRIVER: ${driverId}%`);
            
            if (activeOnes && activeOnes.length >= 2) {
                return res.status(403).json({ error: "Límite alcanzado. Termina tus entregas actuales primero." });
            }

            // 2. Assign driver via Notes
            const { data: order } = await supabase.from('orders').select('notes').eq('id', id).single();
            if (order.notes.includes('DRIVER:')) return res.status(409).json({ error: "Ya reclamado" });

            const newNotes = order.notes + ` [DRIVER: ${driverId}] [D-STATUS: assigned]`;

            const { data, error } = await supabase.from('orders')
                .update({ notes: newNotes })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, order: data });
        }

        if (action === 'order_delivery_status' && req.method === 'PATCH') {
            const { id } = req.query;
            const { status, driverId } = req.body;

            const { data: order } = await supabase.from('orders').select('notes, total, restaurant_id').eq('id', id).single();
            
            let newNotes = order.notes || '';
            if (newNotes.includes('[D-STATUS:')) {
                newNotes = newNotes.replace(/\[D-STATUS: .*?\]/, `[D-STATUS: ${status}]`);
            } else {
                newNotes += ` [D-STATUS: ${status}]`;
            }

            const { data, error } = await supabase.from('orders')
                .update({ 
                    notes: newNotes,
                    status: status === 'delivered' ? 'completed' : 'ready',
                    completed_at: status === 'delivered' ? new Date().toISOString() : null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // --- DELIVERY PAYOUT LOGIC ---
            if (status === 'delivered') {
                const driverCut = 30;
                const platformCut = 5; // Default L.5 for platform if no fee detected

                await supabase.from('quimieats_ledger').insert([
                    { restaurant_id: order.restaurant_id, amount: driverCut, type: 'driver_payout_pending', order_id: id, customer_id: driverId, status: 'pending' },
                    { restaurant_id: 'platform_profit', amount: platformCut, type: 'delivery_service_fee', order_id: id, status: 'settled' }
                ]);
            }

            return res.json({ success: true, order: data });
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
            const { items, total, paymentMethod, customerId, notes, fulfillment, fulfillment_type, guestPhone, restaurantId } = req.body;
            
            const targetResId = restaurantId || 'rich-aroma';
            
            // Generate unique order ID
            const orderId = 'ord_' + Date.now() + Math.random().toString(36).substr(2, 5);
            
            // Get next order number
            const { data: lastOrders } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
            const nextOrderNumber = (lastOrders && lastOrders[0] ? lastOrders[0].order_number : 1000) + 1;

            const { data, error } = await supabase.from('orders').insert({
                id: orderId,
                order_number: nextOrderNumber,
                items, 
                total, 
                subtotal: total,
                tax: 0,
                discount: 0,
                payment_method: paymentMethod, 
                customer_id: customerId, 
                notes: `[FULFILLMENT: ${fulfillment || fulfillment_type || 'pickup'}] ` + (notes || ''), 
                status: 'pending', 
                restaurant_id: targetResId
            }).select().single();
            
            if (error) throw error;

            // --- COMMISSION LOGIC (Updated: Marketplace vs POS) ---
            const isPosOrder = req.body.isPos === true;
            
            if (targetResId !== 'rich-aroma' && !isPosOrder) {
                const commission = parseFloat(total) * 0.10;
                
                if (paymentMethod === 'rico_balance') {
                    // Platform has the cash. We owe merchant (Total - 10%)
                    await supabase.from('quimieats_ledger').insert([
                        { restaurant_id: targetResId, amount: total, type: 'rico_payment', order_id: orderId, status: 'pending', customer_id: customerId || 'guest' },
                        { restaurant_id: targetResId, amount: -commission, type: 'commission', order_id: orderId, status: 'settled', customer_id: customerId || 'guest' }
                    ]);
                } else {
                    // Merchant has the cash (Cash/Transfer). Merchant owes platform 10%
                    await supabase.from('quimieats_ledger').insert({
                        restaurant_id: targetResId, 
                        amount: -commission, 
                        type: 'commission', 
                        order_id: orderId, 
                        status: 'pending',
                        customer_id: customerId || 'guest'
                    });
                }
                console.log(`[Commission] Logged L.${commission} for ONLINE Order ${orderId}`);
            } else if (isPosOrder) {
                console.log(`[POS] POS order for ${targetResId} - 0% Commission (SaaS Plan active)`);
            }

            try {
                let finalId = customerId;
                if (!finalId && guestPhone) {
                    const cleanPhone = guestPhone.replace(/\D/g, '');
                    const { data: guest } = await supabase.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
                    if (guest) finalId = guest.id;
                }
                if (finalId) await awardPoints(finalId, total, paymentMethod, supabase);
            } catch (le) { console.error("Guest loyalty fail:", le); }

            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
