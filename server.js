const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8083;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

// ============== API ROUTES ==============

// MENU
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
app.get('/api/orders', async (req, res) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
    res.json({ orders: data || [] });
});

app.post('/api/orders', async (req, res) => {
    // Get next order number from max existing
    const { data: maxOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1);
    
    const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
    
    const newOrder = {
        id: `ORD-${String(orderNum).padStart(4, '0')}`,
        order_number: orderNum,
        items: req.body.items,
        subtotal: req.body.subtotal,
        tax: req.body.tax || 0,
        discount: req.body.discount || 0,
        total: req.body.total,
        status: 'pending',
        payment_method: req.body.paymentMethod,
        customer_id: req.body.customerId,
        discount_code: req.body.discountCode,
        notes: req.body.notes
    };
    
    const { data, error } = await supabase.from('orders').insert(newOrder).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.patch('/api/orders/:id', async (req, res) => {
    const updates = { ...req.body };
    if (req.body.status === 'completed') {
        updates.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
});

// EMPLOYEES
app.get('/api/employees', async (req, res) => {
    const { data } = await supabase.from('employees').select('*').eq('active', true);
    res.json({ employees: data || [] });
});

// TIMECLOCK
app.get('/api/timeclock', async (req, res) => {
    const { data } = await supabase
        .from('timeclock')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
    res.json({ punches: data || [] });
});

app.post('/api/timeclock', async (req, res) => {
    const punch = {
        employee_id: req.body.employeeId,
        type: req.body.type
    };
    
    const { data, error } = await supabase.from('timeclock').insert(punch).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// SCHEDULE
app.get('/api/schedule', async (req, res) => {
    const { data } = await supabase
        .from('schedule')
        .select('*, employees(name, color)')
        .gte('date', new Date().toISOString().split('T')[0]);
    res.json({ shifts: data || [] });
});

app.post('/api/schedule/shift', async (req, res) => {
    const { data, error } = await supabase.from('schedule').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// INVENTORY
app.get('/api/inventory', async (req, res) => {
    const { data } = await supabase.from('inventory').select('*').order('name');
    res.json({ items: data || [] });
});

app.patch('/api/inventory/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('inventory')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

// WASTE
app.get('/api/waste', async (req, res) => {
    const { data } = await supabase
        .from('waste')
        .select('*, inventory(name)')
        .order('created_at', { ascending: false });
    res.json({ entries: data || [] });
});

app.post('/api/waste', async (req, res) => {
    const entry = {
        item_id: req.body.itemId,
        quantity: req.body.quantity,
        reason: req.body.reason,
        recorded_by: req.body.recordedBy
    };
    
    const { data, error } = await supabase.from('waste').insert(entry).select().single();
    if (error) return res.status(500).json({ error: error.message });
    
    // Decrement inventory
    await supabase.rpc('decrement_inventory', { 
        item_id: req.body.itemId, 
        amount: req.body.quantity 
    });
    
    res.json(data);
});

// CUSTOMERS (Loyalty)
app.get('/api/customers', async (req, res) => {
    const { data } = await supabase.from('customers').select('*').order('name');
    res.json({ customers: data || [] });
});

app.get('/api/customers/phone/:phone', async (req, res) => {
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

app.patch('/api/customers/:id', async (req, res) => {
    const updates = { ...req.body };
    
    // Update tier based on points
    if (updates.points !== undefined) {
        if (updates.points >= 1500) updates.tier = 'gold';
        else if (updates.points >= 500) updates.tier = 'silver';
        else updates.tier = 'bronze';
    }
    
    const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Customer not found' });
    res.json(data);
});

// Rico Balance - Load funds
app.post('/api/customers/:id/load-balance', async (req, res) => {
    const amount = parseFloat(req.body.amount) || 0;
    const bonus = Math.round(amount * 0.10);
    const totalCredit = amount + bonus;
    
    // Get current customer
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .single();
    
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    // Update balance
    const newBalance = (parseFloat(customer.rico_balance) || 0) + totalCredit;
    const newLoaded = (parseFloat(customer.total_loaded) || 0) + amount;
    
    await supabase
        .from('customers')
        .update({ rico_balance: newBalance, total_loaded: newLoaded })
        .eq('id', req.params.id);
    
    // Log transaction
    await supabase.from('balance_history').insert({
        customer_id: req.params.id,
        type: 'load',
        amount: amount,
        bonus: bonus
    });
    
    res.json({ success: true, loaded: amount, bonus, newBalance });
});

// Rico Balance - Pay with balance
app.post('/api/customers/:id/pay-balance', async (req, res) => {
    const amount = parseFloat(req.body.amount) || 0;
    
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .single();
    
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    const currentBalance = parseFloat(customer.rico_balance) || 0;
    if (currentBalance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const newBalance = currentBalance - amount;
    await supabase
        .from('customers')
        .update({ rico_balance: newBalance })
        .eq('id', req.params.id);
    
    await supabase.from('balance_history').insert({
        customer_id: req.params.id,
        type: 'payment',
        amount: -amount,
        order_id: req.body.orderId
    });
    
    res.json({ success: true, paid: amount, newBalance });
});

// === Creator Submissions API ===

app.get('/api/creator-submissions', async (req, res) => {
    const { data } = await supabase
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

app.post('/api/creator-submissions/:id/review', async (req, res) => {
    const { status, pointsAwarded } = req.body;
    
    const { data: sub, error } = await supabase
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
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', sub.phone)
            .single();
        
        if (customer) {
            await supabase
                .from('customers')
                .update({ points: (customer.points || 0) + sub.points_awarded })
                .eq('id', customer.id);
        }
        
        // Check if creator qualifies for discount code (3+ approved)
        const { data: allApproved } = await supabase
            .from('creator_submissions')
            .select('id')
            .eq('phone', sub.phone)
            .eq('status', 'approved');
        
        if ((allApproved?.length || 0) >= 3) {
            const { data: existingCreator } = await supabase
                .from('creators')
                .select('*')
                .eq('phone', sub.phone)
                .single();
            
            if (!existingCreator) {
                const name = customer?.name || 'CREATOR';
                const code = 'RICO-' + name.split(' ')[0].toUpperCase().slice(0, 6);
                
                await supabase.from('creators').insert({
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

// ============== ADMIN API ROUTES ==============

// ADMIN: Menu Management
app.get('/api/admin/menu', async (req, res) => {
    const { data } = await supabase.from('menu_items').select('*').order('category').order('name');
    res.json({ items: data || [] });
});

app.post('/api/admin/menu', async (req, res) => {
    const item = {
        name: req.body.name,
        name_es: req.body.name_es,
        category: req.body.category,
        price: req.body.price,
        description: req.body.description,
        available: req.body.available !== false
    };
    
    const { data, error } = await supabase.from('menu_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/menu/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('menu_items')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

app.delete('/api/admin/menu/:id', async (req, res) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
});

// ADMIN: Inventory Management
app.post('/api/admin/inventory', async (req, res) => {
    const item = {
        name: req.body.name,
        category: req.body.category,
        quantity: req.body.quantity || 0,
        min_stock: req.body.min_stock || 0,
        unit: req.body.unit || 'units'
    };
    
    const { data, error } = await supabase.from('inventory').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/inventory/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('inventory')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json(data);
});

app.delete('/api/admin/inventory/:id', async (req, res) => {
    const { error } = await supabase.from('inventory').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
});

// ADMIN: Employee Management
app.get('/api/admin/employees', async (req, res) => {
    const { data } = await supabase.from('employees').select('*').order('name');
    res.json({ employees: data || [] });
});

app.post('/api/admin/employees', async (req, res) => {
    const emp = {
        name: req.body.name,
        role: req.body.role || 'barista',
        pin: req.body.pin,
        hourly_rate: req.body.hourly_rate || 0,
        color: req.body.color || '#D4A574',
        active: req.body.active !== false
    };
    
    const { data, error } = await supabase.from('employees').insert(emp).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/employees/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('employees')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Employee not found' });
    res.json(data);
});

app.delete('/api/admin/employees/:id', async (req, res) => {
    const { error } = await supabase.from('employees').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
});

// ADMIN: Challenges Management
app.get('/api/admin/challenges', async (req, res) => {
    const { data } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    res.json({ challenges: data || [] });
});

app.post('/api/admin/challenges', async (req, res) => {
    const challenge = {
        id: 'ch_' + Date.now(),
        title: req.body.title,
        description: req.body.description,
        platform: req.body.platform || 'any',
        points: req.body.points || 100,
        active: req.body.active !== false
    };
    
    const { data, error } = await supabase.from('challenges').insert(challenge).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/challenges/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('challenges')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Challenge not found' });
    res.json(data);
});

app.delete('/api/admin/challenges/:id', async (req, res) => {
    const { error } = await supabase.from('challenges').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ success: true });
});

// ADMIN: Promo Codes Management
app.get('/api/admin/promos', async (req, res) => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    res.json({ promos: data || [] });
});

app.post('/api/admin/promos', async (req, res) => {
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
    
    const { data, error } = await supabase.from('promo_codes').insert(promo).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/promos/:id', async (req, res) => {
    const updates = { ...req.body };
    if (updates.code) updates.code = updates.code.toUpperCase();
    
    const { data, error } = await supabase
        .from('promo_codes')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Promo code not found' });
    res.json(data);
});

app.delete('/api/admin/promos/:id', async (req, res) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', req.params.id);
    if (error) return res.status(404).json({ error: 'Promo code not found' });
    res.json({ success: true });
});

// ADMIN: Rewards Settings Management
app.get('/api/admin/rewards', async (req, res) => {
    const { data } = await supabase.from('reward_options').select('*').order('points_cost');
    res.json({ rewards: data || [] });
});

app.post('/api/admin/rewards', async (req, res) => {
    const reward = {
        id: 'rw_' + Date.now(),
        name: req.body.name,
        points_cost: req.body.points_cost || 100,
        type: req.body.type || 'free_item',
        description: req.body.description,
        active: req.body.active !== false
    };
    
    const { data, error } = await supabase.from('reward_options').insert(reward).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/rewards/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('reward_options')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Reward not found' });
    res.json(data);
});

app.delete('/api/admin/rewards/:id', async (req, res) => {
    const { error } = await supabase.from('reward_options').delete().eq('id', req.params.id);
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

app.post('/api/admin/go-live', async (req, res) => {
    try {
        // 1. Clear transactional data
        await supabase.from('orders').delete().neq('id', 'xo');
        await supabase.from('timeclock').delete().gt('id', 0);
        await supabase.from('waste').delete().gt('id', 0);
        await supabase.from('creator_submissions').delete().neq('id', 'xo');
        await supabase.from('balance_history').delete().gt('id', 0);
        
        // 2. Disable Practice Mode
        const { error } = await supabase
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
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;
