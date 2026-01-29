const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8083;

// Supabase client (Global Anon Client)
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// --- SECURITY MIDDLEWARE ---

// Verify Supabase Session
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        // For public routes that might behave differently if auth'd, we can just continue
        // But if this is used as a gate, we block.
        // Let's make this a "populate user if exists" middleware, 
        // and separate "enforce" middleware.
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            req.user = user;
            // Create scoped client
            req.supabase = createClient(supabaseUrl, supabaseKey, {
                global: { headers: { Authorization: `Bearer ${token}` } }
            });
        }
    } catch (e) {
        console.error("Auth error:", e);
    }
    next();
};

// Enforce Authentication
const ensureAuthenticated = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Valid Supabase session required' });
    }
    next();
};

// Enforce Admin Role
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Valid Supabase session required' });
    }
    
    // Check if user is an admin. 
    // Option 1: Check metadata (if set by a function)
    // Option 2: Check employees table mapping
    // We'll check the employees table for the user's email/id if linked, 
    // or just assume if they have a specific email/metadata.
    // For this audit, we'll verify they are in the 'employees' table with role 'admin'
    // assuming the employee.id matches user.id OR email matches.
    
    // Fallback: Check if user_metadata has role 'admin'
    if (req.user.app_metadata?.role === 'admin' || req.user.user_metadata?.role === 'admin') {
        return next();
    }

    // Check DB
    // Note: This assumes 'employees' table is secured or we use the scoped client
    const client = req.supabase || supabase;
    const { data: employee } = await client
        .from('employees')
        .select('role')
        .or(`email.eq.${req.user.email},id.eq.${req.user.id}`)
        .single();

    if (employee && employee.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Forbidden: Admin access required' });
};

// Apply Auth Middleware globally (it just checks/populates, doesn't block yet)
app.use(requireAuth);

// Serve static files
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

// ============== API ROUTES ==============

// === AUTH ROUTES ===

// Login (Hybrid: Phone+PIN or Email+Password)
app.post('/api/auth/login', async (req, res) => {
    const { identifier, secret, type } = req.body; // type: 'phone' or 'email'

    if (!identifier || !secret) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        let user;

        if (type === 'phone') {
            // Phone + PIN Login
            // Clean phone number
            const phone = identifier.replace(/\D/g, '');
            
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', phone)
                .single();

            if (error || !data) {
                return res.status(401).json({ error: 'Invalid phone number' });
            }

            // Check PIN
            // In a real app, hash this! For MVP/Demo, simple comparison.
            if (data.pin !== secret) {
                return res.status(401).json({ error: 'Invalid PIN' });
            }
            user = data;

        } else {
            // Email + Password Login
            const email = identifier.toLowerCase();
            
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !data) {
                return res.status(401).json({ error: 'Invalid email' });
            }

            // Check Password
            // In a real app, hash this!
            if (data.password !== secret) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            user = data;
        }

        // Return user data
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                name: user.name,
                role: 'customer',
                email: user.email,
                phone: user.phone,
                points: user.points,
                tier: user.tier,
                is_vip: user.is_vip
            }
        });

    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register (Hybrid)
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, email, secret, type } = req.body; 
    // type: 'phone' (secret=PIN) or 'email' (secret=password)

    try {
        // 1. Check existing
        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
        const cleanEmail = email ? email.toLowerCase() : null;

        if (cleanPhone) {
            const { data: existingPhone } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', cleanPhone)
                .single();
            if (existingPhone) return res.status(400).json({ error: 'Phone already registered' });
        }

        if (cleanEmail) {
            const { data: existingEmail } = await supabase
                .from('customers')
                .select('id')
                .eq('email', cleanEmail)
                .single();
            if (existingEmail) return res.status(400).json({ error: 'Email already registered' });
        }

        // 2. Generate ID
        const { data: maxId } = await supabase
            .from('customers')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);
        
        const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
        const newId = `C${String(nextNum).padStart(3, '0')}`;

        // 3. Prepare Data
        const newUser = {
            id: newId,
            name,
            phone: cleanPhone,
            email: cleanEmail,
            points: 0,
            tier: 'bronze'
        };

        if (type === 'phone') {
            newUser.pin = secret;
        } else {
            newUser.password = secret;
        }

        // 4. Insert
        const { data, error } = await supabase
            .from('customers')
            .insert(newUser)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, user: data });

    } catch (e) {
        console.error("Register error:", e);
        res.status(500).json({ error: e.message || 'Registration failed' });
    }
});

// MENU (Public Read)
app.get('/api/menu', async (req, res) => {
    const { data: items } = await supabase.from('menu_items').select('*').eq('available', true);
    const { data: modifiers } = await supabase.from('menu_modifiers').select('*');
    
    // Category metadata
    const categoryMeta = {
        coffee: { name: 'Coffee', icon: '☕' },
        drinks: { name: 'Drinks', icon: '🧃' },
        food: { name: 'Food', icon: '🍳' },
        desserts: { name: 'Desserts', icon: '🍰' }
    };
    
    // Group items by category
    const grouped = {};
    (items || []).forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push({
            id: item.id,
            name: item.name,
            nameEs: item.name_es,
            price: parseFloat(item.price)
        });
    });
    
    // Transform to array format expected by POS
    const categories = Object.keys(grouped).map(catId => ({
        id: catId,
        name: categoryMeta[catId]?.name || catId,
        icon: categoryMeta[catId]?.icon || '📦',
        items: grouped[catId]
    }));
    
    const modifiersMap = {};
    (modifiers || []).forEach(m => {
        modifiersMap[m.id] = { name: m.name, price: parseFloat(m.price) };
    });
    
    res.json({ categories, modifiers: modifiersMap, taxRate: 0.15 });
});

// ORDERS
app.get('/api/orders', ensureAuthenticated, async (req, res) => {
    // Admin or Staff can see orders
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
    res.json({ orders: data || [] });
});

app.post('/api/orders', async (req, res) => {
    // Public/POS can create orders (Anon allowed)
    
    // 1. Get next order number
    const { data: maxOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1);
    const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
    
    const orderData = {
        id: `ORD-${String(orderNum).padStart(4, '0')}`,
        order_number: orderNum,
        items: req.body.items,
        subtotal: req.body.subtotal,
        tax: req.body.tax || 0,
        discount: req.body.discount || 0,
        // Ensure total includes delivery fee
        total: req.body.total,
        status: 'pending',
        payment_method: req.body.paymentMethod,
        customer_id: req.body.customerId,
        discount_code: req.body.discountCode,
        notes: req.body.notes,
        // Delivery Fields (Temporarily disabled - Schema mismatch)
        // delivery_zone_id: req.body.deliveryZoneId || null,
        // delivery_fee: req.body.deliveryFee || 0,
        // delivery_address: req.body.deliveryAddress || null,
        // Split Payment Defaults (Temporarily disabled - Schema mismatch)
        // amount_paid: 0,
        // amount_due: req.body.total
    };

    // 2. Handle Split Payment / Rico Balance
    if (req.body.paymentMethod === 'rico_balance' && req.body.customerId) {
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', req.body.customerId)
            .single();

        if (customer) {
            const credit = parseFloat(customer.membership_credit) || 0;
            const cash = parseFloat(customer.cash_balance) || 0;
            const available = credit + cash;
            const total = parseFloat(orderData.total);

            let deductCredit = 0;
            let deductCash = 0;
            let paidAmount = 0;

            if (available >= total) {
                // Full Payment
                paidAmount = total;
                orderData.status = 'paid';
                // orderData.amount_paid = total;
                // orderData.amount_due = 0;

                // Deduct logic
                let remaining = total;
                if (credit >= remaining) {
                    deductCredit = remaining;
                } else {
                    deductCredit = credit;
                    deductCash = remaining - credit;
                }
            } else {
                // Partial Payment
                paidAmount = available;
                orderData.status = 'partial_paid'; // Custom status for Ticket
                // orderData.amount_paid = paidAmount;
                // orderData.amount_due = total - paidAmount;

                // Deduct everything
                deductCredit = credit;
                deductCash = cash;
            }

            // Update Customer Balance
            await supabase
                .from('customers')
                .update({
                    membership_credit: credit - deductCredit,
                    cash_balance: cash - deductCash
                })
                .eq('id', customer.id);
            
            // Log Balance History
            if (paidAmount > 0) {
                await supabase.from('balance_history').insert({
                    customer_id: customer.id,
                    type: 'payment',
                    amount: -paidAmount,
                    order_id: orderData.id
                });
            }
        }
    } else if (['cash', 'card'].includes(req.body.paymentMethod)) {
         // Assume paid if cash/card? Usually cash is 'pending' until closed, 
         // but for this logic we might want to track paid amount.
         // If it's a simple order, we leave amount_paid 0 or full depending on workflow.
         // Let's assume standard orders are "paid" upon completion, or "pending" payment.
         // We'll leave defaults (amount_paid=0) for standard flows unless specified.
    }
    
    const { data, error } = await supabase.from('orders').insert(orderData).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.patch('/api/orders/:id', ensureAuthenticated, async (req, res) => {
    // Only auth'd staff can update orders
    const client = req.supabase || supabase;

    // 1. Fetch current order status to prevent double-awarding
    const { data: currentOrder, error: fetchError } = await client
        .from('orders')
        .select('status, customer_id, total, payment_method')
        .eq('id', req.params.id)
        .single();

    if (fetchError || !currentOrder) return res.status(404).json({ error: 'Order not found' });

    const updates = { ...req.body };
    if (req.body.status === 'completed' && currentOrder.status !== 'completed') {
        updates.completed_at = new Date().toISOString();
    }
    
    const { data: updatedOrder, error } = await client
        .from('orders')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Order not found' });

    // 2. Loyalty Logic: Award points if completing an order
    if (req.body.status === 'completed' && currentOrder.status !== 'completed' && updatedOrder.customer_id) {
        try {
            const { data: customer } = await client
                .from('customers')
                .select('*')
                .eq('id', updatedOrder.customer_id)
                .single();

            if (customer) {
                // Calculate Points
                let pointsBase = Math.floor(parseFloat(updatedOrder.total) || 0);
                let multiplier = 1;

                // Bonus: Rico Balance (2x)
                if (updatedOrder.payment_method === 'rico_balance') {
                    multiplier *= 2;
                }

                // Bonus: VIP (2x)
                if (customer.is_vip) {
                    multiplier *= 2;
                }

                const pointsEarned = pointsBase * multiplier;
                
                // Update Customer Stats
                const newPoints = (customer.points || 0) + pointsEarned;
                const newTotalSpent = (parseFloat(customer.total_spent) || 0) + parseFloat(updatedOrder.total);
                const newVisits = (customer.visits || 0) + 1;

                // Check Tier Upgrade
                let newTier = customer.tier || 'bronze';
                if (newPoints >= 1500) newTier = 'gold';
                else if (newPoints >= 500) newTier = 'silver';
                else newTier = 'bronze'; 

                await client
                    .from('customers')
                    .update({
                        points: newPoints,
                        total_spent: newTotalSpent,
                        visits: newVisits,
                        tier: newTier
                    })
                    .eq('id', customer.id);
                
                console.log(`[Loyalty] Awarded ${pointsEarned} points to ${customer.id} for Order ${updatedOrder.id}`);

                // --- BADGE ENGINE ---
                try {
                    const { data: allBadges } = await client.from('badges').select('*');
                    const { data: myBadges } = await client.from('customer_badges').select('badge_id').eq('customer_id', customer.id);
                    const earnedIds = new Set((myBadges || []).map(b => b.badge_id));

                    for (const badge of allBadges || []) {
                        if (earnedIds.has(badge.id)) continue;
                        
                        const criteria = badge.criteria_json || {};
                        let award = false;

                        // 1. Founder
                        if (criteria.type === 'founder') {
                            const numId = parseInt(customer.id.replace(/\D/g, ''));
                            if (numId <= (criteria.max_id || 100)) award = true;
                        }
                        
                        // 2. Early Bird
                        if (criteria.type === 'early_bird') {
                            const { data: hist } = await client
                                .from('orders')
                                .select('created_at')
                                .eq('customer_id', customer.id)
                                .limit(100); 
                            
                            const earlyCount = (hist || []).filter(o => {
                                // Timezone issue? created_at is UTC. 
                                // Honduras is UTC-6. 8AM UTC-6 is 14:00 UTC.
                                // But let's assume local time handling or offset. 
                                // Simpler: use getHours() which uses local server time (if configured) or UTC.
                                // If server is UTC, we need to adjust.
                                // Let's try simple UTC check first. 8AM local = 14:00 UTC.
                                // But if "server" is local dev machine, it uses system time?
                                // Let's use getUTCHours() and offset -6.
                                const date = new Date(o.created_at);
                                const utc = date.getUTCHours();
                                const local = (utc - 6 + 24) % 24; 
                                return local < 8; 
                            }).length;

                            if (earlyCount >= (criteria.count || 5)) award = true;
                        }
                        
                        // 3. Big Spender
                        if (criteria.type === 'big_spender') {
                            if (newTotalSpent >= (criteria.amount || 2000)) award = true;
                        }

                        if (award) {
                            await client.from('customer_badges').insert({
                                customer_id: customer.id,
                                badge_id: badge.id
                            });
                            console.log(`[Badge] Awarded ${badge.name} to ${customer.id}`);
                        }
                    }
                } catch (bErr) {
                    console.error("Badge Engine Error:", bErr);
                }
            }
        } catch (e) {
            console.error("Loyalty update failed:", e);
            // Don't fail the request, just log it.
        }
    }

    res.json(updatedOrder);
});

// EMPLOYEES (Protected)
app.get('/api/employees', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('employees').select('*').eq('active', true);
    res.json({ employees: data || [] });
});

// TIMECLOCK (Protected)
app.get('/api/timeclock', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client
        .from('timeclock')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
    res.json({ punches: data || [] });
});

app.post('/api/timeclock', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const punch = {
        employee_id: req.body.employeeId,
        type: req.body.type
    };
    
    const { data, error } = await client.from('timeclock').insert(punch).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// SCHEDULE (Protected)
app.get('/api/schedule', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client
        .from('schedule')
        .select('*, employees(name, color)')
        .gte('date', new Date().toISOString().split('T')[0]);
    res.json({ shifts: data || [] });
});

app.post('/api/schedule/shift', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client.from('schedule').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// INVENTORY (Protected)
app.get('/api/inventory', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('inventory').select('*').order('name');
    res.json({ items: data || [] });
});

app.patch('/api/inventory/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('inventory')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

// WASTE (Protected)
app.get('/api/waste', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client
        .from('waste')
        .select('*, inventory(name)')
        .order('created_at', { ascending: false });
    res.json({ entries: data || [] });
});

app.post('/api/waste', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const entry = {
        item_id: req.body.itemId,
        quantity: req.body.quantity,
        reason: req.body.reason,
        recorded_by: req.body.recordedBy
    };
    
    const { data, error } = await client.from('waste').insert(entry).select().single();
    if (error) return res.status(500).json({ error: error.message });
    
    // Decrement inventory (RPC should handle permission internally or match policy)
    await client.rpc('decrement_inventory', { 
        item_id: req.body.itemId, 
        amount: req.body.quantity 
    });
    
    res.json(data);
});

// CUSTOMERS (Loyalty) - Public/Protected Mix
app.get('/api/customers', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('customers').select('*').order('name');
    res.json({ customers: data || [] });
});

app.get('/api/customers/phone/:phone', async (req, res) => {
    // Allow public lookup for POS by phone? Or require POS auth?
    // Let's assume POS is authenticated or this is allowed.
    // For now, allowing public lookup for convenience, but ideally restricted.
    const phone = req.params.phone.replace(/\D/g, '');
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .single();
    
    if (error || !data) return res.status(404).json({ error: 'Customer not found' });
    res.json(data);
});

app.post('/api/customers', async (req, res) => {
    // POS creates customers
    const { data: existing } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
    const nextNum = existing?.length ? parseInt(existing[0].id.slice(1)) + 1 : 1;
    
    const newCustomer = {
        id: `C${String(nextNum).padStart(3, '0')}`,
        name: req.body.name,
        phone: req.body.phone.replace(/\D/g, ''),
        email: req.body.email,
        points: 0,
        total_spent: 0,
        visits: 0,
        tier: 'bronze'
    };
    
    const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.patch('/api/customers/:id', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const updates = { ...req.body };
    
    // Update tier based on points
    if (updates.points !== undefined) {
        if (updates.points >= 1500) updates.tier = 'gold';
        else if (updates.points >= 500) updates.tier = 'silver';
        else updates.tier = 'bronze';
    }
    
    const { data, error } = await client
        .from('customers')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Customer not found' });
    res.json(data);
});

// Reorder: Get past orders
app.get('/api/customers/:id/past-orders', async (req, res) => {
    const client = req.supabase || supabase;
    const { data: orders } = await client
        .from('orders')
        .select('*')
        .eq('customer_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(5);
    res.json({ orders: orders || [] });
});

// Get badges
app.get('/api/customers/:id/badges', async (req, res) => {
    const { data: badges } = await supabase
        .from('customer_badges')
        .select('*, badges(*)')
        .eq('customer_id', req.params.id);
    
    const { data: allBadges } = await supabase.from('badges').select('*');
    
    res.json({ earned: badges || [], all: allBadges || [] });
});

// Rico Balance - Load funds
app.post('/api/customers/:id/load-balance', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const amount = parseFloat(req.body.amount) || 0;
    
    // Get current customer
    const { data: customer } = await client
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .single();
    
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    // Logic: VIP gets 10% bonus, others get 0
    const isVip = customer.is_vip; // Assuming is_vip boolean is reliable or check expiry
    // Check expiry if needed: new Date(customer.vip_expiry) > new Date()
    // For now, trust the flag or update it elsewhere.
    
    const bonus = isVip ? Math.round(amount * 0.10) : 0;
    const totalCredit = amount + bonus;
    
    // Update balance
    const currentCash = parseFloat(customer.cash_balance) || 0;
    const newCash = currentCash + totalCredit;
    const newLoaded = (parseFloat(customer.total_loaded) || 0) + amount;
    
    await client
        .from('customers')
        .update({ cash_balance: newCash, total_loaded: newLoaded })
        .eq('id', req.params.id);
    
    // Log transaction
    await client.from('balance_history').insert({
        customer_id: req.params.id,
        type: 'load',
        amount: amount,
        bonus: bonus
    });
    
    res.json({ success: true, loaded: amount, bonus, newBalance: newCash });
});

// Membership Purchase
app.post('/api/customers/:id/purchase-membership', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    
    // Logic: 
    // 1. Set is_vip = true
    // 2. Set membership_credit = 500
    // 3. Set membership_credit_expires_at = now + 30 days
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const { data, error } = await client
        .from('customers')
        .update({
            is_vip: true,
            membership_credit: 500,
            membership_credit_expires_at: expiresAt.toISOString(),
            vip_expiry: expiresAt.toISOString() // Assuming VIP status matches credit expiry
        })
        .eq('id', req.params.id)
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    
    // Log transaction (Optional: log the purchase of membership? Or is it a sale in orders?)
    // Usually a membership is sold via an Order first. This endpoint activates it.
    
    res.json({ success: true, customer: data });
});

// Rico Balance - Pay with balance
app.post('/api/customers/:id/pay-balance', async (req, res) => {
    // POS pays - Allow public? Or protected?
    // Should be protected, but POS might be Anon.
    // We'll allow it if valid order_id provided
    const amount = parseFloat(req.body.amount) || 0;
    
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .single();
    
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    let credit = parseFloat(customer.membership_credit) || 0;
    let cash = parseFloat(customer.cash_balance) || 0;
    const totalFunds = credit + cash;
    
    if (totalFunds < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    let remainingToPay = amount;
    let creditDeducted = 0;
    let cashDeducted = 0;
    
    // 1. Deduct from credit first
    if (credit > 0) {
        if (credit >= remainingToPay) {
            creditDeducted = remainingToPay;
            remainingToPay = 0;
        } else {
            creditDeducted = credit;
            remainingToPay -= credit;
        }
    }
    
    // 2. Deduct from cash
    if (remainingToPay > 0) {
        cashDeducted = remainingToPay;
        remainingToPay = 0;
    }
    
    const newCredit = credit - creditDeducted;
    const newCash = cash - cashDeducted;
    
    await supabase
        .from('customers')
        .update({ 
            membership_credit: newCredit,
            cash_balance: newCash 
        })
        .eq('id', req.params.id);
    
    // Log transaction
    await supabase.from('balance_history').insert({
        customer_id: req.params.id,
        type: 'payment',
        amount: -amount,
        order_id: req.body.orderId,
        // Optional: store breakdown in a JSON column or notes if available
    });
    
    res.json({ 
        success: true, 
        paid: amount, 
        breakdown: { credit: creditDeducted, cash: cashDeducted },
        newBalance: newCash + newCredit
    });
});

// === Creator Submissions API ===
// (Kept public for creators to submit)
app.get('/api/creator-submissions', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client
        .from('creator_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });
    res.json(data || []);
});

app.get('/api/creator-submissions/phone/:phone', async (req, res) => {
    const phone = req.params.phone.replace(/\D/g, '');
    
    const { data: submissions } = await supabase
        .from('creator_submissions')
        .select('*')
        .eq('phone', phone)
        .order('submitted_at', { ascending: false });
    
    const approved = (submissions || []).filter(s => s.status === 'approved');
    const totalPoints = approved.reduce((sum, s) => sum + (s.points_awarded || 100), 0);
    
    const { data: creator } = await supabase
        .from('creators')
        .select('*')
        .eq('phone', phone)
        .single();
    
    res.json({
        submissions: submissions || [],
        totalPoints,
        totalCommission: creator?.total_commission || 0,
        discountCode: creator?.discount_code || null,
        codeUses: creator?.code_uses || 0,
        codeSales: creator?.code_sales || 0,
        codeCommission: creator?.code_commission || 0
    });
});

app.post('/api/creator-submissions', async (req, res) => {
    const phone = req.body.phone.replace(/\D/g, '');
    
    // Get creator name from customers
    const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('phone', phone)
        .single();
    
    const submission = {
        id: 'sub_' + Date.now(),
        phone,
        creator_name: customer?.name || null,
        platform: req.body.platform,
        link: req.body.link,
        description: req.body.description,
        status: 'pending'
    };
    
    const { data, error } = await supabase.from('creator_submissions').insert(submission).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, submission: data });
});

app.post('/api/creator-submissions/:id/review', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { status, pointsAwarded } = req.body;
    
    const { data: sub, error } = await client
        .from('creator_submissions')
        .update({
            status,
            reviewed_at: new Date().toISOString(),
            points_awarded: status === 'approved' ? (pointsAwarded || 100) : 0
        })
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Submission not found' });
    
    // If approved, add points to customer
    if (status === 'approved' && sub.phone) {
        const { data: customer } = await client
            .from('customers')
            .select('*')
            .eq('phone', sub.phone)
            .single();
        
        if (customer) {
            await client
                .from('customers')
                .update({ points: (customer.points || 0) + sub.points_awarded })
                .eq('id', customer.id);
        }
        
        // Check if creator qualifies for discount code (3+ approved)
        const { data: allApproved } = await client
            .from('creator_submissions')
            .select('id')
            .eq('phone', sub.phone)
            .eq('status', 'approved');
        
        if ((allApproved?.length || 0) >= 3) {
            const { data: existingCreator } = await client
                .from('creators')
                .select('*')
                .eq('phone', sub.phone)
                .single();
            
            if (!existingCreator) {
                const name = customer?.name || 'CREATOR';
                const code = 'RICO-' + name.split(' ')[0].toUpperCase().slice(0, 6);
                
                await client.from('creators').insert({
                    phone: sub.phone,
                    name: customer?.name,
                    discount_code: code
                });
            }
        }
    }
    
    res.json({ success: true, submission: sub });
});

// === Discount Codes API ===

app.get('/api/discount-codes/:code', async (req, res) => {
    const code = req.params.code.toUpperCase();
    
    // Check creator codes
    const { data: creator } = await supabase
        .from('creators')
        .select('*')
        .eq('discount_code', code)
        .single();
    
    if (creator) {
        return res.json({
            valid: true,
            code: creator.discount_code,
            percent: 20,
            creatorId: creator.phone,
            creatorName: creator.name
        });
    }
    
    // Check promo codes
    const { data: promo } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('active', true)
        .single();
    
    if (promo) {
        return res.json({
            valid: true,
            code: promo.code,
            percent: promo.percent || 10,
            creatorId: null
        });
    }
    
    res.status(404).json({ error: 'Invalid code' });
});

app.post('/api/discount-codes/:code/use', async (req, res) => {
    const code = req.params.code.toUpperCase();
    const { orderTotal, discountAmount } = req.body;
    
    const { data: creator } = await supabase
        .from('creators')
        .select('*')
        .eq('discount_code', code)
        .single();
    
    if (creator) {
        const commission = Math.round(discountAmount * 0.5);
        
        await supabase
            .from('creators')
            .update({
                code_uses: (creator.code_uses || 0) + 1,
                code_sales: (parseFloat(creator.code_sales) || 0) + orderTotal,
                code_commission: (parseFloat(creator.code_commission) || 0) + commission,
                total_commission: (parseFloat(creator.total_commission) || 0) + commission
            })
            .eq('phone', creator.phone);
        
        return res.json({ success: true, commission });
    }
    
    res.json({ success: true });
});


// === DELIVERY ZONES API ===
app.get('/api/delivery-zones', async (req, res) => {
    const { data } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('active', true)
        .order('fee');
    res.json({ zones: data || [] });
});

app.post('/api/delivery-zones', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const zone = {
        name: req.body.name,
        fee: req.body.fee,
        active: req.body.active !== false
    };
    const { data, error } = await client.from('delivery_zones').insert(zone).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/delivery-zones/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('delivery_zones')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(404).json({ error: 'Zone not found' });
    res.json(data);
});

app.delete('/api/delivery-zones/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('delivery_zones').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Zone not found' });
    res.json({ success: true });
});

// === DRIVER API ===

app.post('/api/driver/login', async (req, res) => {
    const { pin } = req.body;
    // Check employees for this PIN and role='driver'
    const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('pin', pin)
        // .eq('role', 'driver') // Optional: enforce role?
        .single();
    
    if (!employee) return res.status(401).json({ error: 'Invalid PIN' });
    if (employee.role !== 'driver' && employee.role !== 'admin') {
        return res.status(403).json({ error: 'Not a driver account' });
    }
    
    res.json({ success: true, driver: employee });
});

app.get('/api/driver/orders', async (req, res) => {
    const { driverId, mode } = req.query;

    if (mode === 'available') {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customers (name, phone)
            `)
            .is('driver_id', null)
            .neq('status', 'completed')
            .eq('delivery_status', 'pending')
            .not('delivery_address', 'is', null) // Ensure it is a delivery order
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ orders: orders || [] });
    }

    if (!driverId) return res.status(400).json({ error: 'Driver ID required' });

    // Fetch orders assigned to this driver that are NOT completed
    // OR orders that are completed today (optional, for history)
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            *,
            customers (name, phone)
        `)
        .eq('driver_id', driverId)
        .neq('delivery_status', 'delivered') // Show active
        .order('created_at', { ascending: true });
        
    if (error) return res.status(500).json({ error: error.message });
    res.json({ orders });
});

app.post('/api/driver/orders/:id/claim', async (req, res) => {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ error: 'Driver ID required' });

    // Atomic update: Only update if driver_id is NULL
    const { data, error } = await supabase
        .from('orders')
        .update({ 
            driver_id: driverId,
            delivery_status: 'assigned'
        })
        .eq('id', req.params.id)
        .is('driver_id', null)
        .select()
        .single();

    if (error || !data) {
        return res.status(409).json({ error: 'Order already claimed or unavailable' });
    }

    res.json({ success: true, order: data });
});

app.patch('/api/orders/:id/assign', ensureAuthenticated, async (req, res) => {
    const { driverId } = req.body;
    const client = req.supabase || supabase;
    
    const { data, error } = await client
        .from('orders')
        .update({ 
            driver_id: driverId,
            delivery_status: 'assigned'
        })
        .eq('id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.patch('/api/orders/:id/delivery-status', async (req, res) => {
    const { status } = req.body; 
    // status: 'out_for_delivery', 'delivered'
    
    const updates = { delivery_status: status };
    if (status === 'delivered') {
        updates.status = 'completed'; 
        updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============== ADMIN API ROUTES (Strictly Secured) ==============

// ADMIN: Menu Management
app.get('/api/admin/menu', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('menu_items').select('*').order('category').order('name');
    res.json({ items: data || [] });
});

app.post('/api/admin/menu', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const item = {
        name: req.body.name,
        name_es: req.body.name_es,
        category: req.body.category,
        price: req.body.price,
        description: req.body.description,
        available: req.body.available !== false
    };
    
    const { data, error } = await client.from('menu_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/menu/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('menu_items')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

app.delete('/api/admin/menu/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('menu_items').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
});

// ADMIN: Inventory Management
app.post('/api/admin/inventory', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const item = {
        name: req.body.name,
        category: req.body.category,
        quantity: req.body.quantity || 0,
        min_stock: req.body.min_stock || 0,
        unit: req.body.unit || 'units'
    };
    
    const { data, error } = await client.from('inventory').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/inventory/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('inventory')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

app.delete('/api/admin/inventory/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('inventory').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
});

// ADMIN: Employee Management
app.get('/api/admin/employees', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('employees').select('*').order('name');
    res.json({ employees: data || [] });
});

app.post('/api/admin/employees', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const emp = {
        name: req.body.name,
        role: req.body.role || 'barista',
        pin: req.body.pin,
        hourly_rate: req.body.hourly_rate || 0,
        color: req.body.color || '#D4A574',
        active: req.body.active !== false
    };
    
    const { data, error } = await client.from('employees').insert(emp).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/employees/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('employees')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Employee not found' });
    res.json(data);
});

app.delete('/api/admin/employees/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('employees').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
});

// ADMIN: Challenges Management
app.get('/api/admin/challenges', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('challenges').select('*').order('created_at', { ascending: false });
    res.json({ challenges: data || [] });
});

app.post('/api/admin/challenges', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const challenge = {
        id: 'ch_' + Date.now(),
        title: req.body.title,
        description: req.body.description,
        platform: req.body.platform || 'any',
        points: req.body.points || 100,
        active: req.body.active !== false
    };
    
    const { data, error } = await client.from('challenges').insert(challenge).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/challenges/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('challenges')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Challenge not found' });
    res.json(data);
});

app.delete('/api/admin/challenges/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('challenges').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ success: true });
});

// ADMIN: Promo Codes Management
app.get('/api/admin/promos', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('promo_codes').select('*').order('created_at', { ascending: false });
    res.json({ promos: data || [] });
});

app.post('/api/admin/promos', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const promo = {
        id: 'promo_' + Date.now(),
        code: req.body.code?.toUpperCase(),
        type: req.body.type || 'percent',
        value: req.body.value || 10,
        max_uses: req.body.max_uses || null,
        uses: 0,
        expires_at: req.body.expires_at || null,
        active: req.body.active !== false
    };
    
    const { data, error } = await client.from('promo_codes').insert(promo).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/promos/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const updates = { ...req.body };
    if (updates.code) updates.code = updates.code.toUpperCase();
    
    const { data, error } = await client
        .from('promo_codes')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Promo code not found' });
    res.json(data);
});

app.delete('/api/admin/promos/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('promo_codes').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Promo code not found' });
    res.json({ success: true });
});

// ADMIN: Rewards Settings Management
app.get('/api/admin/rewards', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client.from('reward_options').select('*').order('points_cost');
    res.json({ rewards: data || [] });
});

app.post('/api/admin/rewards', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const reward = {
        id: 'rw_' + Date.now(),
        name: req.body.name,
        points_cost: req.body.points_cost || 100,
        type: req.body.type || 'free_item',
        description: req.body.description,
        active: req.body.active !== false
    };
    
    const { data, error } = await client.from('reward_options').insert(reward).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/rewards/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('reward_options')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Reward not found' });
    res.json(data);
});

app.delete('/api/admin/rewards/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client.from('reward_options').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Reward not found' });
    res.json({ success: true });
});

// ============== PAGE ROUTES ==============

// SETUP & SETTINGS
app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'setup.html'));
});

app.get('/api/settings', async (req, res) => {
    try {
        const { data, error } = await supabase.from('business_settings').select('*').single();
        // If table doesn't exist or is empty, return defaults
        if (error) {
            return res.json({ 
                name: 'Rich Aroma', 
                currency: 'HNL', 
                tax_rate: 15, 
                is_practice_mode: true, 
                setup_completed: false 
            });
        }
        res.json(data);
    } catch (e) {
        res.json({ is_practice_mode: true, setup_completed: false });
    }
});

app.post('/api/admin/setup', async (req, res) => {
    // Setup might be open initially, or require a key
    // For now, we'll leave it open but maybe we should lock it if setup is complete
    const { business, menu, owner } = req.body;
    
    // 1. Save Business Settings (Upsert to ensure ID 1)
    const { error: settingsError } = await supabase
        .from('business_settings')
        .upsert({
            id: 1, 
            name: business.name,
            currency: business.currency,
            tax_rate: business.taxRate,
            is_practice_mode: true, 
            setup_completed: true
        });
        
    if (settingsError) {
        // If table doesn't exist, this will fail. We might want to try creating it? 
        // For now, assuming schema exists.
        return res.status(500).json({ error: settingsError.message });
    }

    // 2. Add Menu Items
    if (menu && menu.length) {
        const menuItems = menu.map(m => ({
            id: 'item_' + Date.now() + Math.random().toString(36).substr(2,5),
            name: m.name,
            price: parseFloat(m.price),
            category: m.category,
            available: true
        }));
        await supabase.from('menu_items').insert(menuItems);
    }

    // 3. Create Owner
    if (owner) {
        await supabase.from('employees').insert({
            id: 'emp_' + Date.now(),
            name: owner.name,
            pin: owner.pin,
            role: 'admin',
            active: true
        });
    }

    res.json({ success: true });
});

app.post('/api/admin/go-live', requireAdmin, async (req, res) => {
    try {
        const client = req.supabase || supabase;
        // 1. Clear transactional data
        await client.from('orders').delete().neq('id', 'xo');
        await client.from('timeclock').delete().gt('id', 0);
        await client.from('waste').delete().gt('id', 0);
        await client.from('creator_submissions').delete().neq('id', 'xo');
        await client.from('balance_history').delete().gt('id', 0);
        
        // 2. Disable Practice Mode
        const { error } = await client
            .from('business_settings')
            .update({ is_practice_mode: false })
            .eq('id', 1);

        if (error) throw error;
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'admin.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'driver', 'dashboard.html'));
});

app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'order', 'order-v2.html'));
});

app.get('/rewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'teacher-portal.html'));
});

app.get('/rewards/certificate', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'certificate.html'));
});

app.get('/load-balance', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'load-balance.html'));
});

app.get('/creators', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'creators', 'creators.html'));
});

app.get('/creators/review', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'creators', 'review.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check for Vercel
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server (for local dev)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ☕  RICH AROMA OS  ☕                             ║
║                                                       ║
║     Server running on http://localhost:${PORT}          ║
║     Connected to Supabase                             ║
║     SECURITY: Middleware Enabled (Bearer Token)       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;
