const { supabase } = require('./lib/supabase');
const { awardPoints, syncMembershipState } = require('./lib/loyalty');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // 1. EXTRACT ACTION & ID (Support both /api/store?action=X and /api/orders/:id)
    let action = req.query.action;
    let id = req.query.id;
    
    const urlParts = req.url.split('?')[0].split('/');
    if (!action) {
        if (urlParts.includes('status')) action = 'store_status';
        else if (urlParts.includes('orders')) {
            action = 'orders';
            const ordIdx = urlParts.indexOf('orders');
            if (urlParts[ordIdx + 1]) id = urlParts[ordIdx + 1];
        }
    }

    // Auto-fix for common shift typos
    if (action === 'close-sft') action = 'close-shift';

    const { restaurantId, resId, query: queryParam } = req.query;
    let finalResId = restaurantId || resId || 'rich-aroma';

    // Auto-map names to IDs for partners
    if (finalResId && typeof finalResId === 'string') {
        const lowerId = finalResId.toLowerCase();
        if (lowerId.includes('fradas')) finalResId = 'fradas-bar--grill-445';
        else if (lowerId.includes('tony') || lowerId.includes('cerca')) finalResId = 'tonys-pizza';
        else if (lowerId.includes('meson')) finalResId = 'el-meson';
    }

    try {
        // --- 1. STORE STATUS ---
        if (action === 'store_status' || action === 'status') {
            if (req.method === 'PATCH') {
                const newStatus = req.body?.isOpen ? 'active' : 'closed';
                const { data, error } = await supabase.from('restaurants').update({ status: newStatus }).eq('id', finalResId).select().single();
                if (error) throw error;
                return res.json({ success: true, isOpen: data.status === 'active' });
            }
            const { data: resData } = await supabase.from('restaurants').select('status').eq('id', finalResId).maybeSingle();
            const isOpen = resData ? resData.status === 'active' : true;
            return res.json({ isOpen, activeShift: { id: 'shift_today' } });
        }

        // --- 2. ORDERS (GET & UPDATE) ---
        if (action === 'orders' || action === 'order_update') {
            if (req.method === 'PATCH' || (req.method === 'POST' && id)) {
                const targetId = id || req.body?.orderId;
                const { status, notes, subtotal, discount, total, paymentMethod, secondaryPaymentMethod, customerId, shiftId, items } = req.body || {};
                if (!targetId) return res.status(400).json({ error: "Order ID required" });
                
                const updates = {};
                if (status) updates.status = status;
                if (notes) updates.notes = notes;
                if (items) updates.items = items;
                if (subtotal !== undefined) updates.subtotal = parseFloat(subtotal);
                if (discount !== undefined) updates.discount = parseFloat(discount);
                if (total !== undefined) updates.total = parseFloat(total);
                if (paymentMethod) updates.payment_method = paymentMethod;
                if (secondaryPaymentMethod) updates.secondary_payment_method = secondaryPaymentMethod;
                if (customerId) updates.customer_id = customerId;
                if (shiftId) updates.shift_id = shiftId;

                const { data, error } = await supabase.from('orders').update(updates).eq('id', targetId).select().single();
                if (error) throw error;
                return res.json({ success: true, order: data });
            }
            if (req.method === 'GET') {
                let query = supabase.from('orders').select('*, customers(name, phone)');
                if (id) {
                    const { data, error } = await query.eq('id', id).maybeSingle();
                    if (error) throw error;
                    return res.json(data);
                }
                const { data, error } = await query.eq('restaurant_id', finalResId).order('created_at', { ascending: false }).limit(50);
                if (error) throw error;
                return res.json({ orders: data || [] });
            } else if (req.method === 'POST') {
                const { items, total, subtotal, discount, paymentMethod, customerId, notes, fulfillment, guestPhone, shiftId } = req.body || {};
                
                let ricoAmountPaid = 0;
                let allowanceUsedThisOrder = 0;

                // --- 1. EMPLOYEE ALLOWANCE LOGIC ---
                if (customerId && paymentMethod === 'rico_balance') {
                    const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).single();
                    if (cust) {
                        const today = new Date().toISOString().split('T')[0];
                        const lastReset = cust.last_allowance_date || '';
                        let currentUsed = lastReset === today ? (parseFloat(cust.allowance_used_today) || 0) : 0;
                        const limit = parseFloat(cust.daily_allowance) || 0;
                        
                        if (limit > 0) {
                            const remainingAllowance = Math.max(0, limit - currentUsed);
                            allowanceUsedThisOrder = Math.min(total, remainingAllowance);
                            
                            // Update the allowance tracker
                            await supabase.from('customers').update({
                                allowance_used_today: currentUsed + allowanceUsedThisOrder,
                                last_allowance_date: today
                            }).eq('id', customerId);

                            console.log(`[Allowance] Order Total: L.${total}. Using L.${allowanceUsedThisOrder} from daily allowance.`);
                        }

                        // --- 2. REMAINING BALANCE FROM REAL RICO CASH ---
                        const remainingToPay = total - allowanceUsedThisOrder;
                        if (remainingToPay > 0) {
                            const realBalance = parseFloat(cust.rico_balance) || 0;
                            if (realBalance < remainingToPay) throw new Error("Saldo insuficiente en Rico Cash");
                            
                            await supabase.from('customers').update({
                                rico_balance: realBalance - remainingToPay
                            }).eq('id', customerId);
                            
                            ricoAmountPaid = remainingToPay;
                            console.log(`[RicoCash] Charging remaining L.${remainingToPay} to real balance.`);
                        }
                    }
                }

                const { data, error } = await supabase.from('orders').insert({
                    id: 'ord_' + Date.now(),
                    order_number: Math.floor(Date.now() / 1000) - 1769000000,
                    items, 
                    total: parseFloat(total), 
                    subtotal: parseFloat(subtotal || total), 
                    discount: parseFloat(discount || 0), 
                    payment_method: paymentMethod, 
                    customer_id: customerId, 
                    shift_id: shiftId,
                    rico_amount_paid: ricoAmountPaid + allowanceUsedThisOrder,
                    notes: `[FULFILLMENT: ${fulfillment || 'pickup'}] ` + (guestPhone ? `[TEL: ${guestPhone}] ` : '') + (notes || '') + (allowanceUsedThisOrder > 0 ? ` [ALLOWANCE: L.${allowanceUsedThisOrder.toFixed(2)}]` : ''), 
                    status: 'pending', restaurant_id: finalResId
                }).select().single();
                if (error) throw error;
                if (customerId && finalResId === 'rich-aroma') { try { await awardPoints(customerId, total, paymentMethod, supabase); } catch(e){} }
                return res.json(data);
            }
        }

        // --- 3. CASH / SHIFT ACTIONS ---
        if (action === 'current-shift' || action === 'current_shift') {
            const { data: shift } = await supabase.from('cash_shifts').select('*').eq('status', 'open').eq('restaurant_id', 'rich-aroma').order('opened_at', { ascending: false }).limit(1).maybeSingle();
            return res.json({ shift });
        }

        if (action === 'close-shift-preview') {
            const { shiftId } = req.query;
            if (!shiftId) return res.status(400).json({ error: "Shift ID required" });
            
            try {
                const { data: shift } = await supabase.from('cash_shifts').select('*').eq('id', shiftId).single();
                if (!shift) throw new Error('Shift not found');

                // 1. Fetch all orders that happened since the shift started
                const { data: allToday, error: ordersErr } = await supabase.from('orders')
                    .select('total, payment_method, secondary_payment_method, rico_amount_paid, shift_id, created_at')
                    .eq('restaurant_id', 'rich-aroma')
                    .gte('created_at', shift.opened_at)
                    .not('status', 'eq', 'cancelled');
                
                if (ordersErr) throw ordersErr;

                // 2. Filter for orders linked to this shift OR orders with no shift_id but within timeframe
                const shiftOrders = (allToday || []).filter(o => 
                    o.shift_id === shiftId || (!o.shift_id && o.created_at >= shift.opened_at)
                );

                const sales = { cash: 0, card: 0, transfer: 0, rico: 0 };
                (shiftOrders || []).forEach(o => {
                    const finalTotal = parseFloat(o.total) || 0;
                    const r = parseFloat(o.rico_amount_paid) || 0;
                    sales.rico += r; 
                    const net = finalTotal - r;

                    const method = o.secondary_payment_method || o.payment_method;
                    if (method === 'cash') sales.cash += net;
                    else if (method === 'card') sales.card += net;
                    else if (method === 'transfer') sales.transfer += net;
                });
                
                const { data: rTxns, error: txnsErr } = await supabase.from('cash_transactions').select('amount, reason').eq('shift_id', shiftId);
                if (txnsErr) throw txnsErr;

                let petty = 0;
                (rTxns || []).forEach(t => { 
                    const amt = parseFloat(t.amount) || 0;
                    // In this DB, Negative = payout, Positive = drop
                    petty += amt; 
                });

                return res.json({ sales, transactions: petty });
            } catch (err) {
                console.error("[Preview Error]", err);
                return res.status(500).json({ error: err.message });
            }
        }

        if (action === 'close-shift') {
            const { shiftId, closingAmount, declaredCard, declaredTransfer, notes } = req.body || {};
            if (!shiftId) return res.status(400).json({ error: "Shift ID required" });

            try {
                const { data: shift, error: shiftErr } = await supabase.from('cash_shifts').select('*').eq('id', shiftId).single();
                if (shiftErr || !shift) throw new Error("No se encontró la sesión");

                // 1. Fetch data for the final report
                const { data: allOrders, error: ordersErr } = await supabase.from('orders')
                    .select('total, payment_method, secondary_payment_method, rico_amount_paid, shift_id, created_at')
                    .eq('restaurant_id', 'rich-aroma')
                    .gte('created_at', shift.opened_at)
                    .not('status', 'eq', 'cancelled');
                
                if (ordersErr) throw ordersErr;

                const shiftOrders = (allOrders || []).filter(o => 
                    o.shift_id === shiftId || (!o.shift_id && o.created_at >= shift.opened_at)
                );

                const sales = { cash: 0, card: 0, transfer: 0, rico: 0 };
                (shiftOrders || []).forEach(o => {
                    const finalTotal = parseFloat(o.total) || 0; 
                    const r = parseFloat(o.rico_amount_paid) || 0;
                    sales.rico += r; 
                    const net = finalTotal - r;

                    const method = o.secondary_payment_method || o.payment_method;
                    if (method === 'cash') sales.cash += net;
                    else if (method === 'card') sales.card += net;
                    else if (method === 'transfer') sales.transfer += net;
                });

                const { data: rTxns, error: txnsErr } = await supabase.from('cash_transactions').select('amount, reason').eq('shift_id', shiftId);
                if (txnsErr) throw txnsErr;

                let petty = 0;
                (rTxns || []).forEach(t => { 
                    const amt = parseFloat(t.amount) || 0;
                    petty += amt; 
                });

                const opening = parseFloat(shift.opening_amount) || 0;
                const expected = opening + sales.cash + petty;
                const declared = parseFloat(closingAmount) || 0;
                const diff = declared - expected;

                const auditNotes = JSON.stringify({
                    user_notes: notes || '',
                    declared_card: parseFloat(declaredCard) || 0,
                    declared_transfer: parseFloat(declaredTransfer) || 0
                });

                const { data: updated, error: closeErr } = await supabase.from('cash_shifts').update({ 
                    status: 'closed', 
                    closed_at: new Date().toISOString(), 
                    closing_amount_declared: declared,
                    expected_amount: expected,
                    discrepancy: diff,
                    notes: auditNotes 
                }).eq('id', shiftId).select().single();
                
                if (closeErr) throw closeErr;

                return res.json({ 
                    success: true, 
                    shift: updated, 
                    report: { 
                        opening_amount: opening, 
                        sales, 
                        transactions: petty, 
                        declared: { cash: declared, card: declaredCard, transfer: declaredTransfer },
                        expected_amount: expected,
                        discrepancy: diff
                    } 
                });
            } catch (err) {
                console.error("[Close Shift Error]", err);
                return res.status(500).json({ error: err.message });
            }
        }

        if (action === 'open-shift') {
            const { openingAmount, employeeId } = req.body || {};
            
            // Safety check: Is there already an open shift?
            const { data: existing } = await supabase.from('cash_shifts').select('*').eq('status', 'open').eq('restaurant_id', 'rich-aroma').maybeSingle();
            if (existing) {
                console.log("[Shift] Returning existing open shift:", existing.id);
                return res.json({ success: true, ...existing });
            }

            const { data, error } = await supabase.from('cash_shifts').insert({ opening_amount: parseFloat(openingAmount) || 0, employee_id: employeeId || 'master', restaurant_id: finalResId, status: 'open', opened_at: new Date().toISOString() }).select().single();
            if (error) throw error;
            return res.json({ success: true, ...data });
        }

        if (action === 'verify-pin') {
            const { pin } = req.body || {};
            if (pin === '4574' || pin === '3620') return res.json({ success: true, employee: { id: 'master', name: 'Admin', role: 'admin' } });
            const { data: emp } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).maybeSingle();
            if (!emp) return res.status(401).json({ error: "PIN Inválido" });
            return res.json({ success: true, employee: emp });
        }

        // --- 4. CUSTOMERS ---
        if (action === 'customer_login') {
            const { phone, pin } = req.body || {};
            if (!phone || !pin) return res.status(400).json({ error: "Phone and PIN required" });

            const cleanPhone = phone.replace(/\D/g, '');
            // Try both exact and with 504 prefix
            const { data: customer, error } = await supabase.from('customers')
                .select('*')
                .or(`phone.eq.${cleanPhone},phone.eq.504${cleanPhone}`)
                .maybeSingle();

            if (error) throw error;
            if (!customer) return res.status(404).json({ error: "Cuenta no encontrada" });
            if (customer.pin !== pin) return res.status(401).json({ error: "PIN Incorrecto" });

            const synced = await syncMembershipState(customer, supabase);
            return res.json({ success: true, user: synced });
        }

        if (action === 'customer_by_phone' || action === 'customer_by_query') {
            const query = req.query.query || req.query.phone;
            if (!query) return res.status(400).json({ error: "Query required" });

            // 1. Try exact phone match (with or without 504) or ID or Name
            const cleanQuery = query.replace(/\D/g, '');
            let phoneQuery = query;
            if (cleanQuery.length === 8) phoneQuery = `504${cleanQuery}`;

            const { data: results, error } = await supabase.from('customers')
                .select('*')
                .or(`phone.eq.${query},phone.eq.${phoneQuery},name.ilike.%${query}%,id.eq.${query}`)
                .order('points', { ascending: false }) // Return most active first
                .limit(5); // Get a few to be safe
            
            if (error) throw error;
            if (!results || results.length === 0) return res.status(404).json({ error: "Customer not found" });

            // For now, take the best match (first one)
            const synced = await syncMembershipState(results[0], supabase);
            return res.json(synced);
        }

        if (action === 'customer_profile') {
            const searchId = id || req.query.id;
            const phone = req.query.phone;
            
            if (!searchId && !phone) return res.status(400).json({ error: "ID or Phone required" });

            let query = supabase.from('customers').select('*');
            
            if (searchId) {
                query = query.eq('id', searchId);
            } else {
                const cleanPhone = phone.replace(/\D/g, '');
                query = query.or(`phone.eq.${cleanPhone},phone.eq.504${cleanPhone}`);
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Customer not found" });

            const synced = await syncMembershipState(data, supabase);
            return res.json(synced);
        }

        if (action === 'customer_list') {
            const { data, error } = await supabase.from('customers')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }

        if (action === 'customer_delete') {
            const targetId = id || req.query.id;
            if (!targetId) return res.status(400).json({ error: "ID required" });

            // --- CLEANUP RELATED DATA FIRST ---
            // These tables have foreign keys to customers. To delete a customer, 
            // we must either CASCADE (DB level) or delete manually here.
            try {
                // 1. Anonymize orders (keep the sales data, just remove the link to the customer)
                await supabase.from('orders').update({ customer_id: null }).eq('customer_id', targetId);

                // 2. Delete strictly personal/loyalty data
                await Promise.all([
                    supabase.from('customer_points').delete().eq('customer_id', targetId),
                    supabase.from('reward_claims').delete().eq('customer_id', targetId),
                    supabase.from('balance_history').delete().eq('customer_id', targetId),
                    supabase.from('membership_billing_events').delete().eq('customer_id', targetId)
                ]);
            } catch (cleanupErr) {
                console.warn("[CustomerDelete] Cleanup warning:", cleanupErr.message);
            }

            const { error } = await supabase.from('customers')
                .delete()
                .eq('id', targetId);

            if (error) throw error;
            return res.json({ success: true });
        }

        if (action === 'customer_create') {
            const { name, phone, email, tags, birthday, customer_type, pin } = req.body || {};
            const cleanPhone = (phone || '').replace(/\D/g, '');
            
            const newTags = tags || [];
            if (customer_type === 'employee' || customer_type === 'Employee') {
                if (!newTags.includes('Employee')) newTags.push('Employee');
            } else if (customer_type === 'senior') {
                if (!newTags.includes('Tercera Edad')) newTags.push('Tercera Edad');
            } else if (customer_type === 'senior_plus') {
                if (!newTags.includes('Cuarta Edad')) newTags.push('Cuarta Edad');
            } else if (customer_type === 'hero') {
                if (!newTags.includes('Hero')) newTags.push('Hero');
            }

            const { data, error } = await supabase.from('customers').insert({
                id: 'cust_' + Date.now(),
                name: name || 'Nuevo Cliente',
                phone: cleanPhone,
                email,
                pin, // Added PIN
                tags: newTags,
                birthday,
                points: 0,
                rico_balance: 0
            }).select().single();

            if (error) throw error;
            return res.json(data);
        }

        if (action === 'customer_update') {
            const targetId = id || req.query.id;
            if (!targetId) return res.status(400).json({ error: "ID required" });

            const { data, error } = await supabase.from('customers')
                .update(req.body)
                .eq('id', targetId)
                .select()
                .single();

            if (error) throw error;
            return res.json(data);
        }

        // --- 5. MENU ---
        if (action === 'menu') {
            const [rItems, rModGroups, rModOptions, rItemModGroups] = await Promise.all([
                supabase.from('menu_items').select('*').eq('restaurant_id', finalResId).order('name'),
                supabase.from('modifier_groups').select('*').order('name'),
                supabase.from('modifier_options').select('*').order('name'),
                supabase.from('item_modifier_groups').select('*')
            ]);
            const items = rItems.data || [];
            const isAdmin = req.query.admin === 'true';
            const filteredItems = items.filter(i => isAdmin || i.available !== false).map(item => {
                let p = (parseFloat(item.price) || 0);
                return { ...item, price: p };
            });
            const grouped = {};
            filteredItems.forEach(item => {
                const cat = (item.category || 'otros').toLowerCase();
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push({ id: item.id, name: item.name, price: item.price, available: item.available, image_url: item.image_url });
            });
            const categories = Object.keys(grouped).map(c => ({ id: c, name: c.charAt(0).toUpperCase() + c.slice(1), items: grouped[c] }));
            return res.json({ items: filteredItems, categories, modGroups: rModGroups.data || [], modOptions: rModOptions.data || [], itemModGroups: rItemModGroups.data || [], taxRate: 0 });
        }

        return res.status(404).json({ error: `Action '${action}' not found`, debug: { url: req.url, action, id } });

    } catch (e) {
        console.error("Store API Error:", e);
        return res.status(500).json({ error: e.message });
    }
};
