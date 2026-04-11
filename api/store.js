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

function applyVipBenefits(orderItems, customer, paymentMethod) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;
    const isVip = customer.is_vip === true || (Array.isArray(customer.tags) && customer.tags.includes('VIP'));
    const canClaimFreeDrink = isVip && (customer.last_free_drink_date !== today);

    const processedItems = (orderItems || []).map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && item.is_vip_free_eligible) {
            appliedDiscount = finalPrice;
            finalPrice = 0;
            freeDrinkClaimedThisOrder = true;
            item.is_free_benefit = true;
        }
        if (isVip && paymentMethod === 'rico_balance' && item.is_house_made && finalPrice > 0) {
            const discount = finalPrice * 0.10;
            finalPrice -= discount;
            appliedDiscount += discount;
        }
        return { 
            ...item, 
            finalPrice: parseFloat(finalPrice.toFixed(2)), 
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)) 
        };
    });

    return { 
        items: processedItems, 
        total: parseFloat(processedItems.reduce((s,i) => s + (i.finalPrice * i.qty), 0).toFixed(2)), 
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
    const id = (item.id || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    return id.startsWith('hot_') || id.startsWith('cold_') || id.startsWith('frappe_') || 
           name.includes('combo') || name.includes('latte') || name.includes('caf') || 
           name.includes('jugo') || name.includes('frappe') || name.includes('tés') ||
           cat.includes('coffee') || cat.includes('drinks') || cat.includes('heladas');
}

function isFood(item) {
    const id = (item.id || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    return id.startsWith('food_') || name.includes('baleada') || name.includes('sandwich') || 
           name.includes('combo') || name.includes('crepa') || name.includes('toast') ||
           cat.includes('food') || cat.includes('comida');
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

        // CUSTOMER LOGIN
        if (action === 'customer_login' && req.method === 'POST') {
            const { phone, pin } = req.body;
            if (!phone || !pin) return res.status(400).json({ error: "Teléfono y PIN requeridos" });
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const { data: customer, error } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single();
            if (error || !customer) return res.status(404).json({ error: "Usuario no encontrado" });
            if (customer.pin && customer.pin !== pin) return res.status(401).json({ error: "PIN incorrecto" });
            const synced = await syncMembershipState(customer);
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

        // ORDERS POST
        if (action === 'orders' && req.method === 'POST') {
            const { items, subtotal, total, customerId, paymentMethod, notes, fulfillmentType, status } = req.body;
            
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
                const calculation = applyVipBenefits(itemsWithMeta, customer, paymentMethod);
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

            // Inject fulfillment type into notes since column is missing
            let finalNotes = notes || '';
            if (fulfillmentType) {
                finalNotes += ` [TYPE: ${fulfillmentType}]`;
            }

            const orderData = {
                id: `ORD-${getHondurasDate()}-${Date.now().toString().slice(-4)}`,
                order_number: orderNum,
                items: finalOrder.items,
                subtotal: parseFloat(subtotal) || 0,
                discount: finalOrder.discount || 0,
                total: finalOrder.total,
                status: status || 'pending',
                payment_method: paymentMethod,
                customer_id: customerId,
                notes: finalNotes
            };

            if (paymentMethod === 'rico_balance' && customer) {
                const balance = parseFloat(customer.rico_balance) || 0;
                if (balance >= orderData.total) {
                    orderData.status = 'paid';
                    await supabase.from('customers').update({ rico_balance: balance - orderData.total }).eq('id', customer.id);
                } else return res.status(400).json({ error: "Saldo insuficiente" });
            }

            const { data, error } = await supabase.from('orders').insert(orderData).select().single();
            if (error) throw error;
            return res.json(data);
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
                // 1. VIP Activation
                if (order.customer_id) {
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

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
