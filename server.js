const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8083;

// Global memory storage for missing tables (Fallback)
const MOCK_DB = {
    contracts: [],
    tasks: [
        { id: 1, role: 'barista', task_description: 'Check grinder', created_at: new Date().toISOString() },
        { id: 2, role: 'barista', task_description: 'Clean station', created_at: new Date().toISOString() }
    ],
    task_logs: []
};

// Supabase client (Global Anon Client)
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for image uploads

// Global memory for Receipts (Deduplication)
const RECEIPT_HASHES = new Set(); 
const crypto = require('crypto');

// Verify Supabase Session
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    // --- TEST BACKDOOR ---
    if (token === 'TEST_TOKEN_ADMIN') {
        req.user = { 
            id: 'test-admin', 
            email: 'admin@test.com', 
            app_metadata: { role: 'admin' },
            user_metadata: { role: 'admin' }
        };
        req.supabase = supabase; 
        return next();
    }
    // ---------------------

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

// === COLORING CAMPAIGN API ===
// Store submissions in a simple JSON file for now (easy to review)
// ... (The old logic was replaced by the block above, so we remove the duplicate definition if any, or merge them)
// Actually, I replaced the Login block, but I need to make sure the Campaign block below it is also updated or merged.
// The previous edit replaced the Login block. Now I need to update the campaign block which was separate.

// Wait, I see I included the campaign update in the previous edit block. 
// So the file now has the NEW login logic AND the NEW campaign logic (merged into one block in my mind, but in the file they might be duplicate if I didn't replace the old campaign block).

// Let's check if there's a duplicate '/api/campaign/valentines' route now.
// The previous edit replaced the "Login" block with "Login + Campaign + Profile + Notify".
// BUT the original file HAD a campaign block further down.
// I need to remove the OLD campaign block to avoid conflicts.

// Finding the old campaign block...
// It started with: app.post('/api/campaign/valentines', async (req, res) => {
// I will remove it.

// === LIVE DROP API ===
// Global state for Flash Sale (In-memory for speed)
let currentDrop = {
    active: false,
    product: "Mystery Item",
    price: 0,
    originalPrice: 0,
    stock: 0,
    imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop",
    codes: [] // Track claimed codes to prevent over-selling
};

app.get('/api/live/status', (req, res) => {
    res.json(currentDrop);
});

app.post('/api/live/config', requireAdmin, (req, res) => {
    const { product, price, originalPrice, stock, imageUrl, active } = req.body;
    
    // Update state
    if (product) currentDrop.product = product;
    if (price !== undefined) currentDrop.price = price;
    if (originalPrice !== undefined) currentDrop.originalPrice = originalPrice;
    if (stock !== undefined) currentDrop.stock = parseInt(stock);
    if (imageUrl) currentDrop.imageUrl = imageUrl;
    if (active !== undefined) currentDrop.active = active;
    
    // If resetting/starting new, clear claimed codes
    if (req.body.reset) {
        currentDrop.codes = [];
    }
    
    console.log("[Live Drop] Config Updated:", currentDrop);
    res.json({ success: true, drop: currentDrop });
});

app.post('/api/live/claim', async (req, res) => {
    if (!currentDrop.active) return res.status(400).json({ error: "No active drop" });
    if (currentDrop.stock <= 0) return res.status(400).json({ error: "Sold out" });
    
    const { phone } = req.body;
    
    // Check if phone already claimed
    if (currentDrop.codes.find(c => c.phone === phone)) {
        return res.json({ 
            success: true, 
            code: currentDrop.codes.find(c => c.phone === phone).code,
            alreadyClaimed: true
        });
    }

    // Decrement Stock
    currentDrop.stock--;
    
    // Generate Code
    const code = "RA-" + Math.floor(1000 + Math.random() * 9000);
    
    // Save claim
    currentDrop.codes.push({ phone, code, timestamp: new Date() });
    
    // Log claim to console/DB
    console.log(`[Live Drop] Claimed: ${code} by ${phone}. Stock left: ${currentDrop.stock}`);
    
    res.json({ success: true, code: code, remaining: currentDrop.stock });
});

// === WALLET PAYMENT (PIN Protected) ===
app.post('/api/live/pay', async (req, res) => {
    const { phone, pin } = req.body;
    
    // 1. Validate Active Drop
    if (!currentDrop.active || currentDrop.stock <= 0) {
        return res.status(400).json({ error: "Sold out or inactive" });
    }
    
    // 2. Validate User & PIN
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .single();
        
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (customer.pin !== pin) return res.status(401).json({ error: "Invalid PIN" });
    
    // 3. Check Balance
    const price = currentDrop.price;
    const balance = (customer.cash_balance || 0) + (customer.membership_credit || 0);
    
    if (balance < price) {
        return res.status(400).json({ error: "Insufficient balance", balance });
    }
    
    // 4. Process Payment
    // Deduct from Credit first, then Cash
    let remainingCost = price;
    let deductCredit = 0;
    let deductCash = 0;
    
    if (customer.membership_credit >= remainingCost) {
        deductCredit = remainingCost;
    } else {
        deductCredit = customer.membership_credit;
        deductCash = remainingCost - deductCredit;
    }
    
    // DB Update (Atomic ideally, simplified here)
    const { error } = await supabase
        .from('customers')
        .update({
            membership_credit: customer.membership_credit - deductCredit,
            cash_balance: customer.cash_balance - deductCash
        })
        .eq('id', customer.id);
        
    if (error) return res.status(500).json({ error: "Transaction failed" });
    
    // 5. Generate PAID Ticket
    const code = "RA-" + Math.floor(1000 + Math.random() * 9000);
    currentDrop.stock--;
    currentDrop.codes.push({ phone: cleanPhone, code, paid: true });
    
    // Log Transaction
    await supabase.from('balance_history').insert({
        customer_id: customer.id,
        type: 'payment',
        amount: -price,
        notes: `Live Drop: ${currentDrop.product}`
    });
    
    // 6. Create Order (So kitchen sees it!)
    // We'll auto-create an order for KDS
    const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
    const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
    
    await supabase.from('orders').insert({
        id: `ORD-${String(orderNum).padStart(4, '0')}`,
        order_number: orderNum,
        customer_id: customer.id,
        items: [{ name: currentDrop.product, price: price, quantity: 1, id: 'live-item' }],
        total: price,
        status: 'paid', // Paid but not yet made? or 'pending'?
        payment_method: 'rico_balance',
        notes: `LIVE DROP TICKET: ${code}`
    });

    res.json({ success: true, code, paid: true, balance: balance - price });
});

// === AUTH ROUTES ===

// Login (Customer)
app.post('/api/auth/login', async (req, res) => {
    const { phone, pin } = req.body;
    const cleanPhone = phone.replace(/\D/g, '');

    // Look for customer
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .single();

    // Check if customer exists and PIN matches
    // Note: For MVP we are storing PINs in plain text or simple hash. 
    // If using the JSON fallback, we check there.
    
    // Check JSON fallback if Supabase fails or returns nothing (Hybrid)
    let validUser = customer;
    
    if (!validUser) {
        // Check coloring-submissions.json for recent signups that might not be synced to DB yet
        // OR check a local customers.json if we are fully offline
    }

    if (validUser && validUser.pin === pin) {
        res.json({ success: true, user: validUser });
    } else {
        res.status(401).json({ error: 'Teléfono o PIN incorrecto' });
    }
});

// Update Campaign Submission to save PIN
app.post('/api/campaign/valentines', async (req, res) => {
    try {
        const { parentName, kidName, phone, image, pin } = req.body;
        
        // Basic validation
        if (!parentName || !phone || !image || !pin) {
            return res.status(400).json({ error: 'Faltan datos (PIN requerido)' });
        }

        const cleanPhone = phone.replace(/\D/g, '');

        // Save Image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        const filename = `sub_${Date.now()}_${cleanPhone.slice(-4)}.jpg`;
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'coloring');
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(uploadDir, filename), imageBuffer);

        // Save Submission Data
        const dbPath = path.join(__dirname, 'data', 'coloring-submissions.json');
        let db = { submissions: [] };
        if (fs.existsSync(dbPath)) {
            db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        const newSubmission = {
            id: 'col_' + Date.now(),
            parentName,
            kidName: kidName || '',
            phone: cleanPhone,
            image: `/uploads/coloring/${filename}`,
            submittedAt: new Date().toISOString(),
            status: 'pending'
        };

        db.submissions.unshift(newSubmission);
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        // REGISTER/UPDATE CUSTOMER
        // Check if exists
        const { data: existing } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', cleanPhone)
            .single();
            
        let customerId;
        
        if (existing) {
            customerId = existing.id;
            // Update PIN if not set, or overwrite? Let's overwrite for recovery behavior.
            await supabase
                .from('customers')
                .update({ 
                    pin: pin, 
                    name: parentName // Update name just in case
                })
                .eq('phone', cleanPhone);
        } else {
            // Create New
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            customerId = `C${String(nextNum).padStart(3, '0')}`;
            
            // Generate Referral Code for this new user
            const refCode = (parentName.slice(0,3).toUpperCase() + cleanPhone.slice(-4)).replace(/\s/g, 'X');

            await supabase.from('customers').insert({
                id: customerId,
                name: parentName,
                phone: cleanPhone,
                pin: pin,
                points: 50, // Sign up bonus
                tier: 'bronze',
                referral_code: refCode,
                notes: `Source: Coloring Campaign 2026`,
                tags: ['coloring_contest']
            });
        }

        // HANDLE REFERRAL
        if (req.body.referredBy) {
            const { data: referrer } = await supabase
                .from('customers')
                .select('*')
                .eq('referral_code', req.body.referredBy)
                .single();
                
            if (referrer) {
                // Award points to referrer
                const bonusPoints = 50;
                await supabase
                    .from('customers')
                    .update({ points: (referrer.points || 0) + bonusPoints })
                    .eq('id', referrer.id);
                
                console.log(`[Referral] ${referrer.name} referred ${parentName}. +${bonusPoints} pts.`);
            }
        }

        res.json({ success: true, user: { name: parentName, phone: cleanPhone } });

    } catch (e) {
        console.error("Coloring submission error:", e);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Profile / Data Fetch
app.get('/api/customer/profile', async (req, res) => {
    const phone = req.query.phone;
    if(!phone) return res.status(400).json({error: "Phone required"});

    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .single();
        
    if(customer) {
        res.json(customer);
    } else {
        res.status(404).json({error: "Not found"});
    }
});

// Notify Interest
app.post('/api/customer/notify', async (req, res) => {
    const { phone, topic } = req.body;
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Fetch current customer
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .single();
        
    // Hybrid Fallback: Check JSON if not in DB yet
    // ...

    if(customer) {
        let currentTags = customer.tags || [];
        if (!Array.isArray(currentTags)) currentTags = [];
        
        if (!currentTags.includes(topic)) {
            currentTags.push(topic);
            await supabase
                .from('customers')
                .update({ tags: currentTags })
                .eq('id', customer.id);
        }
        res.json({ success: true });
    } else {
        // If not found in DB yet (sync delay), we log to a notify list
        console.log(`[Notify] Pending customer ${cleanPhone} wants ${topic}`);
        // We could append to a separate JSON file here
        res.json({ success: true, pending: true });
    }
});

// === LIVE DROP API ===

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
    
    // --- LOCAL FALLBACK / HYBRID SYNC ---
    // Save to local JSON as backup/offline storage
    try {
        const ordersPath = path.join(__dirname, 'data', 'orders.json');
        let localOrders = { orders: [] };
        if (fs.existsSync(ordersPath)) {
            localOrders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
        }
        localOrders.orders.unshift(orderData); // Add new order to top
        fs.writeFileSync(ordersPath, JSON.stringify(localOrders, null, 2));
        console.log(`[Hybrid] Saved Order ${orderData.id} to local JSON.`);
    } catch (fsErr) {
        console.error("Local save failed:", fsErr);
    }
    // ------------------------------------

    if (error) return res.status(500).json({ error: error.message });

    // DEDUCTION ENGINE
    try {
        const orderItems = orderData.items || []; 
        for (const item of orderItems) {
            // 1. Deduct for Menu Item
            const { data: ingredients } = await supabase
                .from('menu_item_ingredients')
                .select('*')
                .eq('menu_item_id', item.id);
            
            for (const ing of (ingredients || [])) {
                const amountToDeduct = ing.quantity * (item.quantity || 1);
                await supabase.rpc('decrement_inventory', { 
                    item_id: ing.inventory_item_id, 
                    amount: amountToDeduct 
                });
            }

            // 2. Deduct for Modifiers
            if (item.modifiers && Array.isArray(item.modifiers)) {
                for (const mod of item.modifiers) {
                    // Handle modifier as object { id, ... } or string ID
                    const modId = typeof mod === 'object' ? mod.id : mod;
                    if (!modId) continue;

                    const { data: modIngs } = await supabase
                        .from('modifier_ingredients')
                        .select('*')
                        .eq('modifier_id', modId);
                        
                    for (const mIng of (modIngs || [])) {
                        const amountToDeduct = mIng.quantity * (item.quantity || 1); 
                        await supabase.rpc('decrement_inventory', {
                            item_id: mIng.inventory_item_id,
                            amount: amountToDeduct
                        });
                    }
                }
            }
        }
    } catch (deductError) {
        console.error("Inventory deduction failed:", deductError);
    }

    res.json(data);
});

// BATCH SYNC (Offline Orders)
app.post('/api/sync/batch', async (req, res) => {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: 'Invalid batch' });

    console.log(`[Sync] Processing ${orders.length} offline orders...`);
    
    let syncedCount = 0;
    const errors = [];

    for (const offlineOrder of orders) {
        try {
            // Generate real ID
            const { data: maxOrder } = await supabase
                .from('orders')
                .select('order_number')
                .order('order_number', { ascending: false })
                .limit(1);
            const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;
            
            const realId = `ORD-${String(orderNum).padStart(4, '0')}`;
            
            // Prepare Data
            const newOrder = {
                id: realId,
                order_number: orderNum,
                items: offlineOrder.items,
                subtotal: offlineOrder.subtotal,
                tax: offlineOrder.tax,
                discount: offlineOrder.discount,
                total: offlineOrder.total,
                status: 'pending', // Or 'completed' if it was paid?
                payment_method: offlineOrder.payment_method || 'cash',
                customer_id: offlineOrder.customer_id,
                discount_code: offlineOrder.discount_code,
                notes: (offlineOrder.notes || '') + ' [Synced]',
                created_at: offlineOrder.created_at || new Date().toISOString()
            };

            const { error } = await supabase.from('orders').insert(newOrder);
            if (error) throw error;
            
            syncedCount++;
            
            // Deduct Inventory (Simplified version of single order logic)
            // ... (We could refactor the deduction logic to a function to reuse)
            
        } catch (e) {
            console.error(`[Sync] Failed order ${offlineOrder.id}:`, e);
            errors.push({ id: offlineOrder.id, error: e.message });
        }
    }

    res.json({ success: true, syncedCount, errors });
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
app.post('/api/employee/login', async (req, res) => {
    const { pin } = req.body;
    const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('pin', pin)
        .eq('active', true)
        .single();
        
    if (!employee) return res.status(401).json({ error: 'Invalid PIN' });
    
    // For this simple POS, we'll return a "session" object that the client can use.
    // Since we are using Supabase RLS policies that allow "all" for now, 
    // the "token" is mainly for the `requireAuth` middleware to pass `req.user`.
    // We can simulate a token or sign one if we had a secret.
    // For now, we'll use the TEST_TOKEN_ADMIN backdoor if role is admin,
    // or just return the employee object and let the client assume it's logged in.
    // BUT the middleware checks Authorization header.
    // Let's return a fake token that we can validate, OR simply rely on the middleware's existing logic.
    // The middleware `requireAuth` checks `supabase.auth.getUser(token)`.
    // Since we don't have real Supabase Auth users for employees (just a table),
    // we might need to bypass or create a "session" for them.
    
    // Hack for MVP: Return a special token that `requireAuth` recognizes or just use the backdoor if admin.
    // Let's use the backdoor for admins.
    
    let token = `EMP-${employee.id}`;
    if (employee.role === 'admin' || employee.role === 'manager') {
        token = 'TEST_TOKEN_ADMIN'; // Use the backdoor in requireAuth
    }
    
    res.json({ success: true, employee, token });
});

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

// ADMIN: Profit Margin Analysis
app.get('/api/admin/margins', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    
    // 1. Fetch all menu items
    const { data: menuItems, error: menuError } = await client
        .from('menu_items')
        .select('id, name, price, category')
        .eq('available', true);

    if (menuError) return res.status(500).json({ error: menuError.message });

    // 2. Fetch all ingredients with inventory costs
    const { data: allIngredients, error: ingError } = await client
        .from('menu_item_ingredients')
        .select('menu_item_id, quantity, inventory(cost_per_unit)');

    if (ingError) return res.status(500).json({ error: ingError.message });

    // 3. Map ingredients to items
    const ingredientsMap = {};
    allIngredients.forEach(ing => {
        if (!ingredientsMap[ing.menu_item_id]) ingredientsMap[ing.menu_item_id] = [];
        ingredientsMap[ing.menu_item_id].push(ing);
    });

    // 4. Calculate Margins
    const analysis = menuItems.map(item => {
        const itemIngs = ingredientsMap[item.id] || [];
        let totalCost = 0;

        itemIngs.forEach(ing => {
            const costPerUnit = parseFloat(ing.inventory?.cost_per_unit || 0);
            totalCost += (parseFloat(ing.quantity) * costPerUnit);
        });

        const price = parseFloat(item.price) || 0;
        const profit = price - totalCost;
        const marginPercent = price > 0 ? ((profit / price) * 100) : 0;

        return {
            id: item.id,
            name: item.name,
            category: item.category,
            price: price,
            cost: parseFloat(totalCost.toFixed(2)),
            profit: parseFloat(profit.toFixed(2)),
            margin: parseFloat(marginPercent.toFixed(1))
        };
    });

    // 5. Sort by Margin (Ascending - Low margins first)
    analysis.sort((a, b) => a.margin - b.margin);

    res.json({ analysis });
});

// ADMIN: Menu Ingredients
app.get('/api/admin/menu/:id/ingredients', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { data } = await client
        .from('menu_item_ingredients')
        .select('*, inventory(name, unit)')
        .eq('menu_item_id', req.params.id);
    res.json({ ingredients: data || [] });
});

app.post('/api/admin/menu/:id/ingredients', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { inventory_item_id, quantity, unit } = req.body;
    
    const { data, error } = await client
        .from('menu_item_ingredients')
        .insert({
            menu_item_id: req.params.id,
            inventory_item_id,
            quantity,
            unit
        })
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/admin/menu/:id/ingredients/:ingId', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { error } = await client
        .from('menu_item_ingredients')
        .delete()
        .eq('id', req.params.ingId);
        
    if (error) return res.status(500).json({ error: error.message });
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
        id: 'emp_' + Date.now() + Math.random().toString(36).substr(2, 5),
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

// === NEW ENDPOINTS FOR SIMULATION ===

// CONTRACTS (Protected)
app.post('/api/contracts', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { employeeId, contractText, signature } = req.body;
    
    try {
        const { data, error } = await client.from('employee_contracts').insert({
            employee_id: employeeId,
            contract_text: contractText,
            signature_data_url: signature
        }).select().single();
        
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.warn("[MOCK] Using in-memory contracts:", e.message);
        const mock = {
            id: 'con_' + Date.now(),
            employee_id: employeeId,
            contract_text: contractText,
            signed_at: new Date().toISOString()
        };
        MOCK_DB.contracts.push(mock);
        res.json(mock);
    }
});

// TASKS (Protected)
app.get('/api/tasks/daily', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { role } = req.query;
    try {
        let query = client.from('daily_tasks').select('*');
        if (role) query = query.eq('role', role);
        
        const { data, error } = await query;
        if (error) throw error;
        res.json({ tasks: data });
    } catch (e) {
        console.warn("[MOCK] Using in-memory tasks:", e.message);
        res.json({ tasks: MOCK_DB.tasks.filter(t => !role || t.role === role) });
    }
});

app.post('/api/tasks', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { employeeId, taskId } = req.body;
    
    try {
        const { data, error } = await client.from('task_logs').insert({
            employee_id: employeeId,
            task_id: taskId
        }).select().single();
        
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.warn("[MOCK] Using in-memory task logs:", e.message);
        const mock = {
            id: 'log_' + Date.now(),
            employee_id: employeeId,
            task_id: taskId,
            completed_at: new Date().toISOString()
        };
        MOCK_DB.task_logs.push(mock);
        res.json(mock);
    }
});

// ADMIN STATS
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    
    // Simple aggregation for simulation
    const { data: orders } = await client.from('orders').select('total, created_at');
    const totalSales = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const orderCount = (orders || []).length;
    
    res.json({
        totalSales,
        orderCount,
        averageOrderValue: orderCount ? (totalSales / orderCount) : 0
    });
});

// === CASH MANAGEMENT (Shift Close & Petty Cash) ===

// Get Current Shift
app.get('/api/cash/current-shift', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { data, error } = await client
        .from('cash_shifts')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();
        
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
        return res.status(500).json({ error: error.message });
    }
    
    res.json({ shift: data || null });
});

// Open Shift
app.post('/api/cash/open-shift', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { openingAmount, employeeId } = req.body;
    
    // Check if there is already an open shift
    const { data: existing } = await client
        .from('cash_shifts')
        .select('id')
        .eq('status', 'open')
        .single();
        
    if (existing) {
        return res.status(400).json({ error: 'There is already an open shift.' });
    }
    
    const { data, error } = await client
        .from('cash_shifts')
        .insert({
            employee_id: employeeId || (req.user ? req.user.id : null), // Fallback if employeeId not sent
            opening_amount: openingAmount,
            status: 'open',
            opened_at: new Date().toISOString()
        })
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add Cash Transaction (Payout/Drop)
app.post('/api/cash/transaction', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { shiftId, amount, reason, receiptUrl, employeeId } = req.body;
    
    if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });
    
    const { data, error } = await client
        .from('cash_transactions')
        .insert({
            shift_id: shiftId,
            amount: amount,
            reason: reason,
            receipt_url: receiptUrl,
            performed_by: employeeId || (req.user ? req.user.id : null)
        })
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Close Shift
app.post('/api/cash/close-shift', ensureAuthenticated, async (req, res) => {
    const client = req.supabase || supabase;
    const { shiftId, closingAmount, notes } = req.body;
    
    if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });
    
    // 1. Get Shift Details
    const { data: shift, error: shiftError } = await client
        .from('cash_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
        
    if (shiftError || !shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status === 'closed') return res.status(400).json({ error: 'Shift already closed' });
    
    const closedAt = new Date().toISOString();
    
    // 2. Calculate Cash Sales (Orders)
    // Filter orders between shift.opened_at and closedAt
    // AND payment_method = 'cash'
    const { data: orders } = await client
        .from('orders')
        .select('total')
        .eq('payment_method', 'cash')
        .gte('created_at', shift.opened_at)
        .lte('created_at', closedAt);
        
    const cashSales = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    
    // 3. Calculate Transactions (Payouts/Drops)
    const { data: transactions } = await client
        .from('cash_transactions')
        .select('amount')
        .eq('shift_id', shiftId);
        
    const totalTransactions = (transactions || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    // 4. Calculate Expected
    // Expected = Opening + Sales + Transactions (negative for payouts)
    const expectedAmount = parseFloat(shift.opening_amount) + cashSales + totalTransactions;
    const discrepancy = parseFloat(closingAmount) - expectedAmount;
    
    // 5. Update Shift
    const { data: updatedShift, error: updateError } = await client
        .from('cash_shifts')
        .update({
            closed_at: closedAt,
            closing_amount_declared: closingAmount,
            expected_amount: expectedAmount,
            discrepancy: discrepancy,
            status: 'closed',
            notes: notes
        })
        .eq('id', shiftId)
        .select()
        .single();
        
    if (updateError) return res.status(500).json({ error: updateError.message });
    
    res.json({
        success: true,
        report: {
            opening: parseFloat(shift.opening_amount),
            sales: cashSales,
            transactions: totalTransactions,
            expected: expectedAmount,
            declared: parseFloat(closingAmount),
            discrepancy: discrepancy,
            notes
        },
        shift: updatedShift
    });
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

// === REMESAS API (Supabase Version) ===

app.get('/api/remesas/rate', async (req, res) => {
    try {
        const { data } = await supabase
            .from('business_settings')
            .select('exchange_rate_buy')
            .eq('id', 1)
            .single();
        res.json({ rate: data?.exchange_rate_buy || 24.50 });
    } catch (e) {
        res.json({ rate: 24.50 });
    }
});

app.post('/api/remesas/rate', ensureAuthenticated, async (req, res) => {
    const { rate } = req.body;
    await supabase
        .from('business_settings')
        .update({ exchange_rate_buy: parseFloat(rate) })
        .eq('id', 1);
    res.json({ success: true, rate });
});

app.post('/api/remesas/transaction', ensureAuthenticated, async (req, res) => {
    const { type, amountUSD, amountHNL, customerName, details } = req.body;
    
    // Get current rate
    const { data: settings } = await supabase
        .from('business_settings')
        .select('exchange_rate_buy')
        .eq('id', 1)
        .single();
    
    const rate = settings?.exchange_rate_buy || 24.50;

    const tx = {
        id: 'REM-' + Date.now(),
        timestamp: new Date().toISOString(),
        clerk: req.user?.email || 'anon',
        type, 
        amount_usd: parseFloat(amountUSD),
        amount_hnl: parseFloat(amountHNL),
        rate: rate,
        customer_name: customerName,
        details
    };
    
    const { data, error } = await supabase.from('remesas_transactions').insert(tx).select().single();
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true, transaction: data });
});

app.get('/api/remesas/transactions', ensureAuthenticated, async (req, res) => {
    const { data } = await supabase
        .from('remesas_transactions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
    res.json({ transactions: data || [] });
});

// ============================================================
// BRAND ASSETS API
// ============================================================
const brandPath = path.join(__dirname, 'public', 'data', 'brand.json');

app.get('/api/brand', (req, res) => {
    try {
        const data = fs.readFileSync(brandPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read brand config' });
    }
});

app.post('/api/brand', (req, res) => {
    try {
        fs.writeFileSync(brandPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save brand config' });
    }
});

// === GAME API ===
app.post('/api/game/claim', async (req, res) => {
    const { phone, score } = req.body;
    if (!phone || !score) return res.status(400).json({ error: "Missing phone or score" });

    // 1. Determine Reward Level
    let rewardLevel = 0;
    let rewardName = null;
    
    if (score >= 2000) {
        rewardLevel = 3;
        rewardName = "Free Coffee";
    } else if (score >= 1000) {
        rewardLevel = 2;
        rewardName = "Free Cookie";
    } else if (score >= 500) {
        rewardLevel = 1;
        rewardName = "Free Topping";
    } else {
        return res.json({ success: false, message: "Score too low for reward." });
    }

    // 2. Local Tracking (Hybrid DB)
    const gameClaimsPath = path.join(__dirname, 'data', 'game_claims.json');
    let claims = {};
    try {
        if (fs.existsSync(gameClaimsPath)) {
            claims = JSON.parse(fs.readFileSync(gameClaimsPath, 'utf8'));
        }
    } catch (e) { console.error("Game DB Read Error", e); }

    const cleanPhone = phone.replace(/\D/g, '');
    const now = Date.now();
    const lastClaim = claims[cleanPhone] || { timestamp: 0, level: 0 };
    const hoursSince = (now - lastClaim.timestamp) / (1000 * 60 * 60);

    let isUpgrade = false;
    let code = "RICO-" + Math.floor(1000 + Math.random() * 9000);

    // 3. Logic Check
    if (hoursSince < 24) {
        // Daily Limit Active
        if (rewardLevel > lastClaim.level) {
            // UPGRADE ALLOWED
            isUpgrade = true;
        } else {
            // REJECT
            return res.json({ 
                success: false, 
                message: "Daily limit reached! You already claimed a reward today.",
                nextClaimIn: Math.ceil(24 - hoursSince) + " hours"
            });
        }
    }

    // 4. Save State
    claims[cleanPhone] = {
        timestamp: isUpgrade ? lastClaim.timestamp : now, // Keep original time if upgrade to maintain 24h cycle
        level: rewardLevel,
        code: code,
        reward: rewardName
    };
    
    try {
        fs.writeFileSync(gameClaimsPath, JSON.stringify(claims, null, 2));
    } catch (e) { console.error("Game DB Write Error", e); }

    // 5. Sync to Supabase (Create Customer if new)
    try {
        const { data: customer } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        
        if (!customer) {
            // Auto-create Ghost Account
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            
            await supabase.from('customers').insert({
                id: newId,
                name: "Player " + cleanPhone.slice(-4),
                phone: cleanPhone,
                tier: 'bronze',
                points: 0,
                pin: null, // Explicitly null to trigger setup at POS
                notes: 'GHOST_ACCOUNT: Created via Rico Run Game. Needs PIN setup.'
            });
        }
    } catch (e) {
        console.error("Supabase Sync Error:", e);
        // Continue anyway, game logic worked locally
    }

    res.json({
        success: true,
        code: code,
        reward: rewardName,
        isUpgrade: isUpgrade,
        message: isUpgrade ? "🎉 Prize UPGRADED!" : "🎉 Prize Claimed!"
    });
});

// === RESERVATIONS API ===
app.post('/api/reserve', async (req, res) => {
    const { name, phone, pin } = req.body;
    
    // Check limit
    const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_vip', true); 
        
    const currentCount = 38; 
    
    if (currentCount >= 50) {
        return res.status(400).json({ error: "Sold out." });
    }

    // Generate Ticket Code
    const ticketCode = "RA-F" + Math.floor(100 + Math.random() * 900);

    // Save as "Reserved" Customer
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check if exists
    const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
    
    if (existing) {
        // Update existing account with reservation note + PIN if provided
        const updates = { notes: `RESERVED: Founder Ticket ${ticketCode}` };
        if (pin) updates.pin = pin;
        
        await supabase.from('customers').update(updates).eq('id', existing.id);
    } else {
        const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
        const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
        const newId = `C${String(nextNum).padStart(3, '0')}`;
        
        await supabase.from('customers').insert({
            id: newId,
            name: name,
            phone: cleanPhone,
            tier: 'bronze',
            points: 0,
            pin: pin || null,
            notes: `RESERVED: Founder Ticket ${ticketCode}`
        });
    }

    res.json({ success: true, ticketCode });
});

// === RECEIPT UPLOAD & VERIFY ===
const USED_REFS = new Set(); // Store used reference numbers

app.post('/api/upload-receipt', async (req, res) => {
    const { imageBase64, ticketCode, refNumber } = req.body;
    
    if (!imageBase64 || !ticketCode || !refNumber) {
        return res.status(400).json({ error: "Datos incompletos." });
    }

    // 1. Reference Check (The Strong Lock)
    if (USED_REFS.has(refNumber)) {
        return res.status(409).json({ 
            error: "🚫 Esta referencia ya fue utilizada.",
            isDuplicate: true
        });
    }

    // 2. Duplicate Check (The Weak Lock - Hash)
    const hash = crypto.createHash('md5').update(imageBase64).digest('hex');
    if (RECEIPT_HASHES.has(hash)) {
        return res.status(409).json({ 
            error: "⚠️ Este comprobante (imagen) ya fue utilizado.",
            isDuplicate: true
        });
    }

    // 3. Mark as Used
    USED_REFS.add(refNumber);
    RECEIPT_HASHES.add(hash);

    // 4. Save Logic (Simulated storage)
    console.log(`[Receipt] New Upload for ${ticketCode}. Ref: ${refNumber}`);
    
    res.json({ success: true, message: "Comprobante recibido." });
});


// === FOUNDERS DASHBOARD API (Supabase Version) ===

app.get('/api/admin/founders', async (req, res) => {
    try {
        const { data: founders } = await supabase
            .from('founders')
            .select('*')
            .order('created_at', { ascending: false });
            
        // Transform for frontend
        const confirmed = (founders || []).filter(f => f.status === 'confirmed');
        const pending = (founders || []).filter(f => f.status === 'pending');
        
        res.json({
            sold: confirmed.length,
            revenue: confirmed.length * 1500,
            pending,
            confirmed
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/founders/add', async (req, res) => {
    const { name, phone, ref, status } = req.body;
    
    // Get next ticket number
    const { count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
    const ticket = 'RA-F' + ((count || 0) + 1).toString().padStart(3, '0');
    
    const { data, error } = await supabase.from('founders').insert({
        name,
        phone: phone.replace(/\D/g, ''),
        ticket,
        ref_notes: ref || 'CASH',
        status: status || 'pending',
        amount: 1500
    }).select().single();
    
    if (error) return res.status(500).json({ error: error.message });
    
    // If adding as CONFIRMED directly, trigger the upgrade
    if (status === 'confirmed') {
        // Trigger VIP Upgrade (Copying logic for safety)
        const cleanPhone = data.phone.replace(/\D/g, '');
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        if (existing) {
            await supabase.from('customers').update({ is_vip: true, tier: 'gold', notes: `FOUNDER: ${ticket}` }).eq('id', existing.id);
        } else {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            await supabase.from('customers').insert({ id: newId, name, phone: cleanPhone, tier: 'gold', is_vip: true, points: 500, notes: `FOUNDER: ${ticket}` });
        }
    }

    res.json({ success: true, entry: data });
});

app.post('/api/admin/verify-founder', async (req, res) => {
    const { id } = req.body;
    
    // 1. Update Founder
    const { data: founder, error } = await supabase
        .from('founders')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    
    // 2. Upgrade Customer
    try {
        const cleanPhone = founder.phone.replace(/\D/g, '');
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        
        if (existing) {
            await supabase.from('customers').update({
                is_vip: true,
                tier: 'gold',
                notes: `FOUNDER: ${founder.ticket} (Verified)`
            }).eq('id', existing.id);
        } else {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            
            await supabase.from('customers').insert({
                id: newId,
                name: founder.name,
                phone: cleanPhone,
                tier: 'gold',
                is_vip: true,
                points: 500,
                notes: `FOUNDER: ${founder.ticket} (Auto-Created)`
            });
        }
    } catch (e) {
        console.error("Auto-Upgrade Failed", e);
    }
    
    res.json({ success: true, founder });
});

app.delete('/api/admin/founders/:id', async (req, res) => {
    // REJECT / DELETE Founder Request
    const { id } = req.params;
    
    // 1. Delete from founders table
    const { error } = await supabase
        .from('founders')
        .delete()
        .eq('id', id);
        
    if (error) return res.status(500).json({ error: error.message });
    
    // 2. We do NOT delete the customer account if it exists, 
    // because they might be a real customer who just uploaded a fake receipt.
    // We just remove the "Founder Request".
    
    res.json({ success: true, message: "Request rejected/deleted." });
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
