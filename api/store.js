// api/store.js
const { supabase } = require('./lib/supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query; 

    // CUSTOMER LOGIN
    if (action === 'customer_login' && req.method === 'POST') {
        const { phone, pin } = req.body;
        if (!phone || !pin) return res.status(400).json({ error: "Teléfono y PIN requeridos" });
        
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', cleanPhone)
            .single();
            
        if (error || !customer) return res.status(404).json({ error: "Usuario no encontrado" });
        
        if (customer.pin) {
            if (customer.pin !== pin) {
                return res.status(401).json({ error: "PIN incorrecto" });
            }
            return res.json({ message: "Login successful", customer });
        } else {
            // First time setting PIN
            const { error: updateError } = await supabase
                .from('customers')
                .update({ pin: pin })
                .eq('id', customer.id);
                
            if (updateError) return res.status(500).json({ error: "Error al guardar PIN" });
            
            customer.pin = pin;
            return res.json({ message: "PIN creado exitosamente", customer });
        }
    }

    // CUSTOMER LOOKUP
    if (action === 'customer_by_phone' && req.method === 'GET') {
        const query = req.query.query;
        if (!query) return res.status(400).json({ error: 'Missing query' });
        const { data, error } = await supabase.from('customers').select('*').eq('phone', query).single();
        if (error || !data) return res.status(404).json({ error: 'Not found' });

        // Calculate "The Usual"
        const { data: orders } = await supabase.from('orders').select('items').eq('customer_id', data.id);
        if (orders && orders.length > 0) {
            const itemCounts = {};
            const itemObjects = {};
            orders.forEach(order => {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        const key = item.id || item.name;
                        itemCounts[key] = (itemCounts[key] || 0) + 1;
                        itemObjects[key] = item;
                    });
                }
            });
            let maxCount = 0;
            let usualItem = null;
            for (const key in itemCounts) {
                if (itemCounts[key] > maxCount) {
                    maxCount = itemCounts[key];
                    usualItem = itemObjects[key];
                }
            }
            if (usualItem) {
                data.usual_item = usualItem;
            }
        }

        return res.json(data);
    }

    // CUSTOMER PROFILE
    if (action === 'customer_profile' && req.method === 'GET') {
        const query = req.query.phone;
        if (!query) return res.status(400).json({ error: 'Missing phone' });
        const { data, error } = await supabase.from('customers').select('*').eq('phone', query).single();
        if (error || !data) return res.status(404).json({ error: 'Not found' });
        return res.json(data);
    }

    if (action === 'customer_test_cash' && req.method === 'POST') {
        const { phone } = req.body;
        const { data: customer } = await supabase.from('customers').select('*').eq('phone', phone).single();
        if (!customer) return res.status(404).json({ error: 'Not found' });

        const { data, error } = await supabase.from('customers').update({
            rico_balance: (customer.rico_balance || 0) + 500
        }).eq('phone', phone).select().single();

        return res.json(data);
    }
    // CUSTOMER UPDATE (PIN etc)
    if (action === 'customer_create' && req.method === 'POST') {
        const { data: existing } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
        const nextNum = existing?.length ? parseInt(existing[0].id.slice(1)) + 1 : 1;
        
        const newCustomer = {
            id: `C${String(nextNum).padStart(3, '0')}`,
            name: req.body.name,
            phone: (req.body.phone || '').replace(/\D/g, ''),
            email: req.body.email || null,
            points: 0
        };
        const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'load_balance' && req.method === 'POST') {
        const id = req.query.id;
        const { amount } = req.body;
        if (!id || !amount) return res.status(400).json({ error: "Missing ID or amount" });

        const { data: customer, error: fetchErr } = await supabase.from('customers').select('rico_balance').eq('id', id).single();
        if (fetchErr || !customer) return res.status(404).json({ error: "Customer not found" });

        const newBalance = (parseFloat(customer.rico_balance) || 0) + parseFloat(amount);
        const { data, error } = await supabase.from('customers').update({ rico_balance: newBalance }).eq('id', id).select().single();
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, customer: data });
    }

    if (action === 'redeem_points' && req.method === 'POST') {
        const { customerId, prizeId, cost } = req.body;
        if (!customerId || !prizeId || !cost) return res.status(400).json({ error: "Missing data" });

        const { data: customer, error: fetchErr } = await supabase.from('customers').select('*').eq('id', customerId).single();
        if (fetchErr || !customer) return res.status(404).json({ error: "Customer not found" });

        if ((customer.points || 0) < cost) return res.status(400).json({ error: "Insufficient points" });

        const newPoints = customer.points - cost;

        // Apply Reward
        if (prizeId === 'cash_50') {
            const newBalance = (parseFloat(customer.rico_balance) || 0) + 50;
            await supabase.from('customers').update({ points: newPoints, rico_balance: newBalance }).eq('id', customerId);
        } else {
            // Menu Prize - Create a L. 0 order for the kitchen
            const prizeNames = { 'free_americano': 'Americano Gratis (Premio)', 'free_baleada': 'Baleada Sencilla Gratis (Premio)' };
            const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
            const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
            
            await supabase.from('orders').insert({
                id: `PRIZE-${Date.now()}`,
                order_number: orderNum,
                customer_id: customerId,
                items: [{ id: prizeId, name: prizeNames[prizeId] || 'Premio', price: 0, qty: 1, finalPrice: 0 }],
                total: 0,
                status: 'paid',
                payment_method: 'points',
                notes: `[CANJE DE PUNTOS] Cliente: ${customer.name}`
            });

            await supabase.from('customers').update({ points: newPoints }).eq('id', customerId);
        }

        return res.json({ success: true, newPoints });
    }

    if (action === 'customer_update' && req.method === 'PATCH') {
        const id = req.query.id;
        const { pin, notes } = req.body;
        const { data, error } = await supabase.from('customers').update({ pin, notes }).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    // MENU
    if (action === 'menu' && req.method === 'GET') {
        const { data: items } = await supabase.from('menu_items').select('*').eq('available', true);
        
        // Fetch new dynamic modifiers
        const { data: itemModGroups } = await supabase.from('item_modifier_groups').select('item_id, group_id, display_order');
        const { data: modGroups } = await supabase.from('modifier_groups').select('*');
        const { data: modOptions } = await supabase.from('modifier_options').select('*');
        
        return res.json({ items, itemModGroups, modGroups, modOptions, taxRate: 0.00 });
    }

    // ORDERS
    if (action === 'orders' && req.method === 'GET') {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ orders: data });
    }

    if (action === 'orders' && req.method === 'POST') {
        const { items, subtotal, tax, discount, total, customerId, paymentMethod, notes, fulfillment } = req.body;
        const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
        const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
        const id = `ORD-${String(orderNum).padStart(4, '0')}`;
        
        let orderStatus = 'pending';

        // RICO BALANCE DEDUCTION
        if (paymentMethod === 'rico_balance' && customerId) {
            const { data: customer } = await supabase.from('customers').select('rico_balance').eq('id', customerId).single();
            if (customer) {
                const balance = parseFloat(customer.rico_balance) || 0;
                const orderTotal = parseFloat(total) || 0;
                
                if (balance >= orderTotal) {
                    await supabase.from('customers').update({ rico_balance: balance - orderTotal }).eq('id', customerId);
                    orderStatus = 'paid';
                } else {
                    return res.status(400).json({ error: "Insufficient Rico Balance" });
                }
            }
        }

        const orderData = {
            id, 
            order_number: orderNum, 
            items, 
            subtotal: parseFloat(subtotal) || 0, 
            tax: parseFloat(tax) || 0, 
            discount: parseFloat(discount) || 0, 
            total: parseFloat(total) || 0, 
            customer_id: customerId || null, 
            payment_method: paymentMethod, 
            status: orderStatus, 
            notes: `[TIPO: ${fulfillment || 'pickup'}] ${notes || ''}`.trim()
        };

        const { data, error } = await supabase.from('orders').insert(orderData).select().single();
        
        if (error) {
            console.error("Order Insert Error:", error);
            return res.status(500).json({ error: error.message, details: error.details });
        }
        return res.json(data);
    }

    if (action === 'order_update' && req.method === 'PATCH') {
        const id = req.query.id;
        const { status } = req.body;
        
        const { data: currentOrder } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!currentOrder) return res.status(404).json({ error: 'Order not found' });

        // Handle Top-Up Approval
        if (status === 'paid' && currentOrder.status !== 'paid' && currentOrder.items) {
            const reloadItem = currentOrder.items.find(i => i.id === 'rico_cash_reload');
            if (reloadItem && currentOrder.customer_id) {
                const amountToCredit = parseFloat(reloadItem.finalPrice) || 0;
                const { data: customer } = await supabase.from('customers').select('rico_balance').eq('id', currentOrder.customer_id).single();
                if (customer) {
                    const newBalance = (parseFloat(customer.rico_balance) || 0) + amountToCredit;
                    await supabase.from('customers').update({ rico_balance: newBalance }).eq('id', currentOrder.customer_id);
                }
            }
        }

        // If order is being completed, award points to customer based on total
        if (status === 'completed' && currentOrder.status !== 'completed' && currentOrder.customer_id) {
            const { data: customer } = await supabase.from('customers').select('*').eq('id', currentOrder.customer_id).single();
            if (customer) {
                // Calculate Points
                let pointsBase = Math.floor(parseFloat(currentOrder.total) || 0);
                let multiplier = 1;

                // Bonus: Rico Balance (2x)
                if (currentOrder.payment_method === 'rico_balance') multiplier *= 2;
                // Bonus: VIP (2x)
                if (customer.is_vip) multiplier *= 2;

                const pointsEarned = pointsBase * multiplier;
                
                // Update Customer Stats
                const newPoints = (customer.points || 0) + pointsEarned;
                const newTotalSpent = (parseFloat(customer.total_spent) || 0) + parseFloat(currentOrder.total);
                const newVisits = (customer.visits || 0) + 1;

                // Check Tier Upgrade
                let newTier = customer.tier || 'bronze';
                if (newPoints >= 1500) newTier = 'gold';
                else if (newPoints >= 500) newTier = 'silver';
                else newTier = 'bronze'; 

                await supabase.from('customers').update({ 
                    points: newPoints,
                    total_spent: newTotalSpent,
                    visits: newVisits,
                    tier: newTier
                }).eq('id', customer.id);
            }
        }
        
        const { data } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
        return res.json(data);
    }

    if (action === 'order_assign' && req.method === 'PATCH') {
        const id = req.query.id;
        const { driverId } = req.body;
        const { data } = await supabase.from('orders').update({ driver_id: driverId }).eq('id', id).select().single();
        return res.json(data);
    }

    if (action === 'employees' && req.method === 'GET') {
        const { data } = await supabase.from('employees').select('*');
        return res.json({ employees: data });
    }

    // LIVE DROP
    if (action === 'live-status' && req.method === 'GET') {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'live_drop').single();
        return res.json(data?.value || { active: false });
    }

    // UPLOAD RECEIPT
    if (action === 'upload-receipt' && req.method === 'POST') {
        const { imageBase64, ticketCode, refNumber } = req.body;
        const { data: existingRef } = await supabase.from('receipts').select('id').eq('ref_number', refNumber).single();
        if (existingRef) return res.status(409).json({ error: "Used ref" });
        await supabase.from('receipts').insert({ ticket_code: ticketCode, ref_number: refNumber });
        return res.json({ success: true });
    }

    // VALENTINE CAMPAIGN
    if (action === 'valentines' && req.method === 'POST') {
        const { name, kidName, phone } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');
        let { data: customer } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        
        if (!customer) {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            const { data: newCust } = await supabase.from('customers').insert({
                id: newId, name: name, phone: cleanPhone, tier: 'bronze', points: 0, notes: `Kid: ${kidName}`
            }).select().single();
            customer = newCust;
        }
        
        await supabase.from('creator_submissions').insert({
            phone: cleanPhone, creator_name: kidName, platform: 'valentine_art', status: 'approved', points_awarded: 50
        });
        
        // Manual point update (RPC might be missing)
        const currentPoints = (customer.points || 0) + 50;
        await supabase.from('customers').update({ points: currentPoints }).eq('id', customer.id);
        
        return res.json({ success: true });
    }

    res.status(404).json({ error: 'Action not found' });
}