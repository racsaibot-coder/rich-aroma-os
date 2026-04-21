const { supabase } = require('./lib/supabase');

// VIP LOGIC HELPERS
const VIP_MONTHLY_RELOAD = 500.00;
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

async function syncMembershipState(customer) {
    if (!customer) return customer;
    const isVip = customer.is_vip === true || (Array.isArray(customer.tags) && customer.tags.includes('VIP'));
    if (!isVip) return customer;

    const today = getHondurasDate();
    if (customer.next_renewal_date && today >= customer.next_renewal_date) {
        const breakage = parseFloat(customer.rico_balance) || 0;
        try {
            await supabase.from('membership_billing_events').insert({
                customer_id: customer.id,
                event_type: 'renewal_sweep',
                amount_swept: breakage,
                amount_deposited: VIP_MONTHLY_RELOAD
            });
        } catch (e) { console.error("[VIP] Billing log failed", e.message); }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        
        const { data } = await supabase.from('customers').update({
            rico_balance: VIP_MONTHLY_RELOAD,
            next_renewal_date: nextDate.toISOString().split('T')[0]
        }).eq('id', customer.id).select().single();
        if (data) return data;
    }
    return customer;
}

async function syncDailyReload(customer) {
    if (!customer || customer.customer_type !== 'employee') return customer;

    const today = getHondurasDate();
    const lastReload = customer.last_reload_at ? new Date(customer.last_reload_at).toISOString().split('T')[0] : null;

    if (today !== lastReload) {
        // SECURITY LOCK: Only reload if they have an active "in" punch today
        const { data: punch } = await supabase.from('time_entries')
            .select('*')
            .eq('employee_id', customer.id) // Assuming customer ID matches employee ID or we can link them
            .eq('type', 'in')
            .gte('timestamp', today + 'T00:00:00Z')
            .limit(1);

        if (!punch || punch.length === 0) {
            console.log(`[Reload Blocked] Employee ${customer.name} is not clocked in today.`);
            return customer;
        }

        // Reload to 250 Lps
        const { data, error } = await supabase.from('customers').update({
            rico_balance: 250.00,
            last_reload_at: new Date().toISOString()
        }).eq('id', customer.id).select().single();
        
        if (data) {
            await supabase.from('balance_history').insert({
                customer_id: customer.id,
                type: 'daily_employee_reload',
                amount: 250.00,
                notes: `Daily shift meal reload for ${today}`
            });
            return data;
        }
    }
    return customer;
}

function applyOrderBenefits(orderItems, customer, paymentMethod) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;
    
    const isVip = customer?.is_vip === true || (Array.isArray(customer?.tags) && customer?.tags.includes('VIP'));
    
    // Check both column and tags for fallback support
    let customerType = customer?.customer_type || 'regular';
    if (customerType === 'regular' && Array.isArray(customer?.tags)) {
        if (customer.tags.includes('employee')) customerType = 'employee';
        else if (customer.tags.includes('senior')) customerType = 'senior';
        else if (customer.tags.includes('senior_plus')) customerType = 'senior_plus';
        else if (customer.tags.includes('hero')) customerType = 'hero';
    }

    // New specific percentages
    const rolePcts = {
        'senior': 0.25,        // Tercera Edad
        'senior_plus': 0.35,   // Cuarta Edad
        'hero': 0.15,          // Community Hero
        'employee': 0.20       // Staff (standard 20%)
    };

    const isSpecificRole = ['senior', 'senior_plus', 'hero'].includes(customerType);
    let discountedFoodId = null;
    let discountedDrinkId = null;

    const canClaimFreeDrink = isVip && (customer.last_free_drink_date !== today);

    // Sort items by price descending so we apply the discount to the most expensive eligible item
    const sortedItems = [...(orderItems || [])].sort((a,b) => parseFloat(b.price) - parseFloat(a.price));
    
    // We need to keep track of applied discounts across multiple units of the same item
    const processedItems = (orderItems || []).map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        let itemQty = item.qty || 1;
        let totalItemPrice = finalPrice * itemQty;
        let totalItemDiscount = 0;

        // 1. VIP Free Drink (100% off 1 unit of 1 eligible item)
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && item.is_vip_free_eligible) {
            totalItemDiscount += finalPrice;
            freeDrinkClaimedThisOrder = true;
            item.is_free_benefit = true;
        }

        // 2. Role-based Discounts
        let discountPct = rolePcts[customerType] || 0;
        
        // standard VIP 10% on house-made items if paying with Rico Cash
        if (discountPct === 0 && isVip && paymentMethod === 'rico_balance' && item.is_house_made) {
            discountPct = 0.10;
        }

        if (discountPct > 0) {
            if (isSpecificRole) {
                // Rule: One single food and one single beverage ONLY
                let unitsToDiscount = 0;
                if (isFood(item) && !discountedFoodId) {
                    unitsToDiscount = 1;
                    discountedFoodId = item.id;
                } else if (isDrink(item) && !discountedDrinkId) {
                    unitsToDiscount = 1;
                    discountedDrinkId = item.id;
                }
                
                if (unitsToDiscount > 0) {
                    totalItemDiscount += (finalPrice * discountPct);
                }
            } else {
                // Standard role discount (Employee or VIP) applies to ALL units
                totalItemDiscount += (totalItemPrice - totalItemDiscount) * discountPct;
            }
        }

        return { 
            ...item, 
            finalPrice: parseFloat(finalPrice.toFixed(2)), 
            totalDiscount: parseFloat(totalItemDiscount.toFixed(2)),
            unitDiscount: parseFloat((totalItemDiscount / itemQty).toFixed(2)),
            netTotal: parseFloat((totalItemPrice - totalItemDiscount).toFixed(2))
        };
    });

    const finalTotal = processedItems.reduce((s,i) => s + i.netTotal, 0);

    return { 
        items: processedItems, 
        total: parseFloat(finalTotal.toFixed(2)), 
        freeDrinkClaimed: freeDrinkClaimedThisOrder 
    };
}

async function deductInventory(order, supabase) {
    try {
        const orderItems = order.items || [];
        const deductions = {}; // inventory_item_id -> total_quantity

        for (const item of orderItems) {
            const qty = item.quantity || item.qty || 1;
            
            // 1. Fetch Item Ingredients
            const { data: itemIngredients } = await supabase
                .from('menu_item_ingredients')
                .select('inventory_item_id, quantity')
                .eq('menu_item_id', item.id);
            
            if (itemIngredients) {
                for (const ing of itemIngredients) {
                    const id = ing.inventory_item_id;
                    deductions[id] = (deductions[id] || 0) + (parseFloat(ing.quantity) * qty);
                }
            }

            // 2. Fetch Modifier Ingredients
            const selectedMods = item.modifiers || {}; // group_id -> [opt_ids] or opt_id
            const modIds = [];
            for (const gid in selectedMods) {
                const val = selectedMods[gid];
                if (Array.isArray(val)) modIds.push(...val);
                else if (val) modIds.push(val);
            }

            if (modIds.length > 0) {
                const { data: modIngredients } = await supabase
                    .from('modifier_ingredients')
                    .select('inventory_item_id, quantity')
                    .in('modifier_id', modIds);
                
                if (modIngredients) {
                    for (const ing of modIngredients) {
                        const id = ing.inventory_item_id;
                        deductions[id] = (deductions[id] || 0) + (parseFloat(ing.quantity) * qty);
                    }
                }
            }
        }

        // 3. Execute Deductions
        for (const invId in deductions) {
            const amount = deductions[invId];
            await supabase.rpc('decrement_inventory', { item_id: invId, amount: amount });
        }
        
        console.log(`[Inventory] Deducted for order #${order.order_number}`);
    } catch (e) {
        console.error("[Inventory Error]", e);
    }
}

async function awardPoints(customerId, amount, supabase) {
    if (!customerId || amount <= 0) return;
    const { data: customer } = await supabase.from('customers').select('points').eq('id', customerId).single();
    if (!customer) return;
    
    await supabase.from('customers').update({
        points: (customer.points || 0) + Math.floor(amount)
    }).eq('id', customerId);
    console.log(`[Loyalty] Awarded ${Math.floor(amount)} points to ${customerId}`);
}

async function activateVip(id, supabase) {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
    if (!customer) return;

    let newTags = Array.isArray(customer.tags) ? customer.tags : [];
    if (!newTags.includes('VIP')) newTags.push('VIP');

    const nextRenewal = new Date();
    nextRenewal.setDate(nextRenewal.getDate() + 30);

    await supabase
        .from('customers')
        .update({
            is_vip: true,
            rico_balance: (parseFloat(customer.rico_balance) || 0) + 500,
            tier: 'Gold',
            next_renewal_date: nextRenewal.toISOString().split('T')[0],
            tags: newTags
        })
        .eq('id', id);

    await supabase.from('balance_history').insert({
        customer_id: id,
        type: 'vip_activation',
        amount: 500,
        notes: 'VIP Membership Activation Credits'
    });
}

function isDrink(item) {
    if (!item) return false;
    const name = (item.name || '').toLowerCase();
    const id = (item.id || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    if (id === 'vip_membership' || name.includes('membresía')) return false;

    const hasDrinkKeyword = id.startsWith('hot_') || id.startsWith('cold_') || id.startsWith('frappe_') || 
           name.includes('latte') || name.includes('brew') || name.includes('capp') || 
           name.includes('tea') || name.includes('te ') || name.includes('icee') || 
           name.includes('espresso') || name.includes('mocha') || name.includes('matcha') || 
           name.includes('frappe') || name.includes('macchiato') || name.includes('jugo') || 
           name.includes('licuado') || name.includes('granita') || name.includes('smoothie') || 
           name.includes('caliente') || name.includes('helada') || name.includes('americano') ||
           name.includes('chocolate') || name.includes('cafe') || name.includes('café') ||
           cat.includes('coffee') || cat.includes('drinks') || cat.includes('heladas');

    if (id.startsWith('food_') && !name.includes('combo')) return false;
    return hasDrinkKeyword || (name.includes('combo') && !id.startsWith('food_'));
}

function isFood(item) {
    if (!item) return false;
    const name = (item.name || '').toLowerCase();
    const id = (item.id || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    if (id === 'vip_membership' || name.includes('membresía')) return false;

    const hasFoodKeyword = id.startsWith('food_') || name.includes('baleada') || name.includes('sandwich') || 
           name.includes('crepa') || name.includes('bowl') || name.includes('toast') || 
           name.includes('melt') || name.includes('fries') || name.includes('papas') || 
           name.includes('burger') || name.includes('hamburguesa') ||
           cat.includes('food') || cat.includes('comida');

    if ((id.startsWith('hot_') || id.startsWith('cold_') || id.startsWith('frappe_')) && !name.includes('combo')) return false;
    return hasFoodKeyword || (name.includes('combo') && !id.startsWith('hot_') && !id.startsWith('cold_') && !id.startsWith('frappe_'));
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id } = req.query; 

    try {
        // STORE STATUS
        if (action === 'store_status' && req.method === 'GET') {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'store_is_open').single();
            if (error) return res.json({ isOpen: true });
            return res.json({ isOpen: data?.value?.isOpen ?? true });
        }

        if (action === 'store_status' && req.method === 'PATCH') {
            const { isOpen } = req.body;
            const { data, error } = await supabase
                .from('system_settings')
                .upsert({ key: 'store_is_open', value: { isOpen: !!isOpen } })
                .select();
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, isOpen: !!isOpen });
        }

        if (action === 'track_order' && req.method === 'GET') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: "Order ID required" });
            const { data, error } = await supabase.from('orders').select('status').eq('id', id).single();
            if (error) return res.status(404).json({ error: "Order not found" });
            return res.json({ status: data.status });
        }

        // CUSTOMER PROFILE LOOKUP
        if (action === 'customer_profile' && req.method === 'GET') {
            const { phone } = req.query;
            if (!phone) return res.status(400).json({ error: "Phone required" });
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const { data: customer, error } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single();
            if (error) return res.status(404).json({ error: "Customer not found" });
            
            let synced = await syncMembershipState(customer);
            synced = await syncDailyReload(synced);
            
            return res.json(synced);
        }

        // CUSTOMER LOOKUP BY PHONE
        if (action === 'customer_by_phone' && req.method === 'GET') {
            const { query } = req.query;
            if (!query) return res.status(400).json({ error: "Phone required" });
            const cleanDigits = query.replace(/\D/g, '');
            
            // Try exact match first
            let { data: customer, error } = await supabase.from('customers').select('*').eq('phone', query).single();
            
            // If not found, try a partial match on the last 10 digits
            if (!customer) {
                const search = '%' + cleanDigits.slice(-10);
                const { data: partialData } = await supabase.from('customers').select('*').ilike('phone', search).limit(1).single();
                customer = partialData;
            }

            if (error && error.code !== 'PGRST116' && !customer) throw error;
            return res.json(customer || { id: null });
        }

        // CUSTOMER CREATE
        if (action === 'customer_create' && req.method === 'POST') {
            const { name, phone, pin, customer_type, dob } = req.body;
            if (!name || !phone) return res.status(400).json({ error: "Nombre y teléfono requeridos" });
            
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const id = 'CUST-' + Date.now().toString().slice(-6);

            // FALLBACK: Use tags for customer_type and email for dob while columns are missing
            const tags = ['New Member'];
            if (customer_type && customer_type !== 'regular') tags.push(customer_type);

            // New customers get 30 Lps welcome bonus in Rico Cash
            const { data, error } = await supabase.from('customers').insert({
                id,
                name,
                phone: cleanPhone,
                pin: pin || '1234',
                tags: tags,
                email: dob || null, // Temporary place for DOB
                rico_balance: 30.00
            }).select().single();

            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: "Este número ya está registrado" });
                throw error;
            }

            // Log the bonus
            await supabase.from('balance_history').insert({
                customer_id: id,
                type: 'welcome_bonus',
                amount: 30.00,
                notes: 'Welcome Offer Bonus'
            });

            return res.json(data);
        }

        // CUSTOMER LOGIN
        if (action === 'customer_login' && req.method === 'POST') {
            const { phone, pin } = req.body;
            if (!phone || !pin) return res.status(400).json({ error: "Teléfono y PIN requeridos" });
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const { data: customer, error } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single();
            if (error || !customer) return res.status(404).json({ error: "Usuario no encontrado" });
            if (customer.pin && customer.pin !== pin) return res.status(401).json({ error: "PIN incorrecto" });
            
            let synced = await syncMembershipState(customer);
            synced = await syncDailyReload(synced);
            
            return res.json({ message: "Login successful", customer: synced });
        }

        // MENU (Bulletproof version)
        if (action === 'menu' && req.method === 'GET') {
            const isAdmin = req.query.admin === 'true';
            
            const [rItems, rModGroups, rModOptions, rItemModGroups] = await Promise.all([
                supabase.from('menu_items').select('*').order('name'),
                supabase.from('modifier_groups').select('*'),
                supabase.from('modifier_options').select('*').order('name'),
                supabase.from('item_modifier_groups').select('*')
            ]);

            if (rItems.error) console.error("Items Error:", rItems.error);
            const filteredItems = (rItems.data || []).filter(i => isAdmin || i.available !== false).map(item => {
                // Remove heavy base64 data only if it exceeds 50KB
                const cleanItem = { ...item };
                if (cleanItem.image_url && cleanItem.image_url.startsWith('data:') && cleanItem.image_url.length > 50000) {
                    delete cleanItem.image_url;
                }
                return cleanItem;
            });

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
                    image_url: item.image_url || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80',
                    category: rawCat
                });
            });

            const categories = Object.keys(grouped).map(catId => ({
                id: catId,
                name: categoryMeta[catId]?.name || (catId.charAt(0).toUpperCase() + catId.slice(1)),
                items: grouped[catId]
            }));

            return res.json({ 
                items: filteredItems, 
                categories,
                modGroups: rModGroups.data || [], 
                modOptions: rModOptions.data || [], 
                itemModGroups: rItemModGroups.data || [],
                taxRate: 0.00 
            });
        }

        // ORDERS GET
        if (action === 'orders' && req.method === 'GET') {
            const timeLimit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('orders')
                .select('*, customers(name, phone)')
                .gte('created_at', timeLimit)
                .in('status', ['pending', 'paid', 'preparing', 'ready', 'completed', 'drinks_ready', 'food_ready', 'cancelled'])
                .order('created_at', { ascending: false });
            if (error) throw error;

            // Parse fulfillment_type from notes tag [TYPE:...]
            const enhancedOrders = (data || []).map(o => {
                let type = 'dinein'; // Default
                if (o.notes && o.notes.includes('[TYPE:')) {
                    const match = o.notes.match(/\[TYPE:\s*([^\]]+)\]/);
                    if (match) type = match[1].trim();
                }
                return { ...o, fulfillment_type: type };
            });

            return res.json({ orders: enhancedOrders });
        }

        // CUSTOMER PAST ORDERS
        if (action === 'customer_past_orders' && req.method === 'GET') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: "ID de cliente requerido" });
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_id', id)
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;
            return res.json({ orders: data || [] });
        }

        // TOGGLE FAVORITE
        if (action === 'customer_toggle_favorite' && req.method === 'POST') {
            const { customerId, itemId } = req.body;
            if (!customerId || !itemId) return res.status(400).json({ error: "Missing data" });

            const { data: customer } = await supabase.from('customers').select('favorites').eq('id', customerId).single();
            let favorites = Array.isArray(customer?.favorites) ? customer.favorites : [];
            
            if (favorites.includes(itemId)) {
                favorites = favorites.filter(id => id !== itemId);
            } else {
                favorites.push(itemId);
            }

            const { data, error } = await supabase.from('customers').update({ favorites }).eq('id', customerId).select().single();
            if (error) throw error;
            return res.json(data);
        }

        // ORDERS POST
        if (action === 'orders' && req.method === 'POST') {
            const { items, subtotal, total, customerId, paymentMethod, secondaryPaymentMethod, ricoAmount, notes, fulfillmentType, status, scheduledFor, shiftId } = req.body;
            
            // --- HARD LOCK: SHIFT VALIDATION ---
            if (shiftId) {
                const { data: shift } = await supabase.from('cash_shifts').select('status').eq('id', shiftId).single();
                if (!shift || shift.status !== 'open') {
                    return res.status(403).json({ 
                        error: "TURNO CERRADO: No se pueden procesar órdenes en este turno.",
                        code: 'SHIFT_CLOSED'
                    });
                }
            }
            
            let customer = null;
            if (customerId) {
                const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
                if (data) customer = await syncMembershipState(data);
            }

            const itemIds = (items || []).map(i => i.id);
            const { data: menuItems } = await supabase.from('menu_items').select('*').in('id', itemIds);
            
            const itemsWithMeta = (items || []).map(item => {
                const meta = (menuItems || []).find(m => m.id === item.id);
                return {
                    ...item,
                    is_house_made: meta?.is_house_made || false,
                    is_vip_free_eligible: meta?.is_vip_free_eligible || false
                };
            });

            let finalOrder = { items: itemsWithMeta, total: parseFloat(total) || 0, discount: 0 };

            if (customer) {
                const calculation = applyOrderBenefits(itemsWithMeta, customer, paymentMethod);
                finalOrder = calculation;
                if (calculation.freeDrinkClaimed) {
                    await supabase.from('customers').update({ last_free_drink_date: getHondurasDate() }).eq('id', customer.id);
                }
            }

            // Daily Resetting Order Number Logic
            const todayStart = getHondurasDate() + 'T00:00:00.000Z';
            const { data: maxOrder } = await supabase
                .from('orders')
                .select('order_number')
                .gte('created_at', todayStart)
                .order('order_number', { ascending: false })
                .limit(1);
            
            const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;

            // Inject fulfillment type and schedule into notes since columns might be missing
            let finalNotes = notes || '';
            if (fulfillmentType) finalNotes += ` [TYPE: ${fulfillmentType}]`;
            if (scheduledFor) finalNotes += ` [SCHEDULED: ${scheduledFor}]`;
            if (secondaryPaymentMethod) finalNotes += ` [SPLIT: ${paymentMethod} & ${secondaryPaymentMethod}]`;

            // --- AUTO-LINK TO ACTIVE SHIFT ---
            let resolvedShiftId = req.body.shiftId;
            if (!resolvedShiftId) {
                const { data: activeShift } = await supabase.from('cash_shifts').select('id').eq('status', 'open').order('opened_at', {ascending:false}).limit(1).maybeSingle();
                if (activeShift) resolvedShiftId = activeShift.id;
            }

            const orderData = {
                id: `ORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                order_number: orderNum,
                items: finalOrder.items,
                subtotal: parseFloat(subtotal) || finalOrder.total,
                discount: finalOrder.discount || 0,
                total: Math.round(finalOrder.total), // Round to nearest whole number for clean billing
                status: status || 'pending',
                payment_method: paymentMethod,
                secondary_payment_method: secondaryPaymentMethod || null,
                rico_amount_paid: (paymentMethod === 'rico_balance' || secondaryPaymentMethod === 'rico_balance') ? parseFloat(ricoAmount) : 0,
                customer_id: customerId,
                notes: finalNotes,
                shift_id: resolvedShiftId
            };

            // HANDLE RICO CASH DEDUCTION (Support for Split)
            if ((paymentMethod === 'rico_balance' || secondaryPaymentMethod === 'rico_balance') && customer) {
                const balance = parseFloat(customer.rico_balance) || 0;
                const deduction = (secondaryPaymentMethod) ? parseFloat(ricoAmount) : orderData.total;
                
                if (balance >= deduction) {
                    await supabase.from('customers').update({ rico_balance: balance - deduction }).eq('id', customer.id);
                    // Log to balance history
                    await supabase.from('balance_history').insert({
                        customer_id: customer.id,
                        type: 'purchase',
                        amount: -deduction,
                        notes: `Order #${orderNum}${secondaryPaymentMethod ? ' (Split)' : ''}`
                    });
                } else return res.status(400).json({ error: "Saldo insuficiente" });
            }

            const { data, error } = await supabase.from('orders').insert(orderData).select().single();
            if (error) throw error;

            // 3. LOYALTY & VIP POST-PROCESSING
            if (customerId && (paymentMethod === 'rico_balance' || secondaryPaymentMethod)) {
                await awardPoints(customerId, orderData.total, supabase);
                const hasMembership = orderData.items && orderData.items.some(i => i.id === 'vip_membership');
                if (hasMembership) await activateVip(customerId, supabase);
            }

            return res.json(data);
        }

        // TOGGLE INDIVIDUAL ITEM STATUS
        if (action === 'toggle_item_ready' && req.method === 'PATCH') {
            const { orderId, itemIdx, status } = req.body;
            if (!orderId || itemIdx === undefined) return res.status(400).json({ error: "Missing data" });

            const { data: order } = await supabase.from('orders').select('items, status').eq('id', orderId).single();
            if (!order) return res.status(404).json({ error: "Order not found" });

            const newItems = [...order.items];
            if (newItems[itemIdx]) {
                newItems[itemIdx].status = status; // 'ready' or null
            }

            // Check if ALL items are now ready
            const allReady = newItems.every(i => i.status === 'ready');
            const updates = { items: newItems };
            if (allReady) updates.status = 'ready';

            const { data: updated, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single();
            if (error) throw error;
            return res.json(updated);
        }

        // ORDER UPDATE
        if (action === 'order_update' && req.method === 'PATCH') {
            const { items, subtotal, total, customerId, paymentMethod, notes, fulfillmentType, status } = req.body;
            
            const updates = {};
            if (items !== undefined) updates.items = items;
            if (subtotal !== undefined) updates.subtotal = subtotal;
            if (total !== undefined) updates.total = total;
            if (status !== undefined) updates.status = status;
            if (paymentMethod !== undefined) updates.payment_method = paymentMethod;
            if (customerId !== undefined) updates.customer_id = customerId;
            
            if (notes !== undefined || fulfillmentType !== undefined) {
                let finalNotes = notes || '';
                if (fulfillmentType) finalNotes += ` [TYPE: ${fulfillmentType}]`;
                updates.notes = finalNotes;
            }

            const { data: order, error } = await supabase.from('orders').update(updates).eq('id', id).select().single();
            if (error) throw error;
            
            // Check if we should automatically set to 'ready'
            if (status === 'drinks_ready' || status === 'food_ready') {
                const itemsList = order.items || [];
                const hasD = itemsList.some(i => isDrink(i));
                const hasF = itemsList.some(i => isFood(i));
                
                let autoReady = false;
                if (order.status === 'drinks_ready' && !hasF) autoReady = true;
                if (order.status === 'food_ready' && !hasD) autoReady = true;
                
                if (autoReady) {
                    const { data: updated } = await supabase.from('orders').update({ status: 'ready' }).eq('id', id).select().single();
                    return res.json(updated);
                }
            }

            const isPaidOrDone = ['paid', 'ready', 'completed'].includes(order.status);
            
            if (isPaidOrDone) {
                // 1. VIP Activation & Loyalty Points
                if (order.customer_id) {
                    await awardPoints(order.customer_id, order.total, supabase);
                    const hasMembership = order.items && order.items.some(i => i.id === 'vip_membership');
                    if (hasMembership) await activateVip(order.customer_id, supabase);
                }
                // 2. Inventory Deduction
                await deductInventory(order, supabase);
            }
            return res.json(order);
        }

        if (action === 'membership_request' && req.method === 'POST') {
            const { customerId, name, phone } = req.body;
            const orderData = { id: `VIP-${Date.now()}`, order_number: 9999, items: [{ id: 'vip_membership', name: 'Membresía VIP (Mensual)', price: 1500, qty: 1 }], subtotal: 1500, total: 1500, status: 'pending', payment_method: 'transfer', customer_id: customerId, notes: `Solicitud de Membresía VIP para ${name} (${phone})` };
            const { data, error } = await supabase.from('orders').insert(orderData).select().single();
            if (error) throw error;
            return res.json(data);
        }

        if (action === 'customer_update_photo' && req.method === 'POST') {
            const { customerId, imageBase64, fileName } = req.body;
            if (!customerId || !imageBase64) return res.status(400).json({ error: "Missing data" });

            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
            const ext = mimeType.split('/')[1] || 'png';
            
            const storagePath = `avatars/CUST_${customerId}_${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(storagePath);

            const { data, error } = await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', customerId).select().single();
            if (error) throw error;
            return res.json(data);
        }

        // CUSTOMER VIP PURCHASE
        if (action === 'purchase_membership' && req.method === 'POST') {
            const customerId = req.query.id;
            if (!customerId) return res.status(400).json({ error: "Customer ID required" });

            const { data: customer, error: fetchErr } = await supabase.from('customers').select('*').eq('id', customerId).single();
            if (fetchErr || !customer) return res.status(404).json({ error: "Customer not found" });

            const VIP_PRICE = 250;
            if ((customer.rico_balance || 0) < VIP_PRICE) {
                return res.status(400).json({ error: "Saldo Rico Cash insuficiente (L 250 requeridos)" });
            }

            const { data: updated, error: updateErr } = await supabase.from('customers')
                .update({ 
                    is_vip: true, 
                    rico_balance: customer.rico_balance - VIP_PRICE,
                    vip_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                })
                .eq('id', customerId)
                .select().single();

            if (updateErr) throw updateErr;
            return res.json({ success: true, customer: updated });
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
