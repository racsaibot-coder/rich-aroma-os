const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8083;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Data directory
const DATA_DIR = path.join(__dirname, 'data');

// Helper to read JSON file
function readJSON(filename) {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// Helper to write JSON file
function writeJSON(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ============== API ROUTES ==============

// MENU
app.get('/api/menu', (req, res) => {
    res.json(readJSON('menu.json'));
});

// ORDERS
app.get('/api/orders', (req, res) => {
    res.json(readJSON('orders.json'));
});

app.post('/api/orders', (req, res) => {
    const data = readJSON('orders.json') || { orders: [], lastOrderNumber: 0 };
    const newOrder = {
        ...req.body,
        id: `ORD-${String(data.lastOrderNumber + 1).padStart(4, '0')}`,
        orderNumber: data.lastOrderNumber + 1,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    data.orders.push(newOrder);
    data.lastOrderNumber++;
    writeJSON('orders.json', data);
    res.json(newOrder);
});

app.patch('/api/orders/:id', (req, res) => {
    const data = readJSON('orders.json');
    const order = data.orders.find(o => o.id === req.params.id);
    if (order) {
        Object.assign(order, req.body);
        if (req.body.status === 'completed') {
            order.completedAt = new Date().toISOString();
        }
        writeJSON('orders.json', data);
        res.json(order);
    } else {
        res.status(404).json({ error: 'Order not found' });
    }
});

// EMPLOYEES
app.get('/api/employees', (req, res) => {
    res.json(readJSON('employees.json'));
});

// TIMECLOCK
app.get('/api/timeclock', (req, res) => {
    res.json(readJSON('timeclock.json'));
});

app.post('/api/timeclock', (req, res) => {
    const data = readJSON('timeclock.json') || { punches: [] };
    const punch = {
        ...req.body,
        timestamp: new Date().toISOString()
    };
    data.punches.push(punch);
    writeJSON('timeclock.json', data);
    res.json(punch);
});

// SCHEDULE
app.get('/api/schedule', (req, res) => {
    res.json(readJSON('schedule.json'));
});

app.post('/api/schedule/shift', (req, res) => {
    const data = readJSON('schedule.json');
    data.shifts.push(req.body);
    writeJSON('schedule.json', data);
    res.json(data);
});

app.put('/api/schedule', (req, res) => {
    writeJSON('schedule.json', req.body);
    res.json(req.body);
});

// INVENTORY
app.get('/api/inventory', (req, res) => {
    res.json(readJSON('inventory.json'));
});

app.patch('/api/inventory/:id', (req, res) => {
    const data = readJSON('inventory.json');
    const item = data.items.find(i => i.id === req.params.id);
    if (item) {
        Object.assign(item, req.body);
        writeJSON('inventory.json', data);
        res.json(item);
    } else {
        res.status(404).json({ error: 'Item not found' });
    }
});

// WASTE
app.get('/api/waste', (req, res) => {
    res.json(readJSON('waste.json'));
});

app.post('/api/waste', (req, res) => {
    const data = readJSON('waste.json') || { entries: [] };
    const entry = {
        ...req.body,
        timestamp: new Date().toISOString()
    };
    data.entries.push(entry);
    writeJSON('waste.json', data);
    
    // Also decrement inventory
    const inventory = readJSON('inventory.json');
    const item = inventory.items.find(i => i.id === req.body.itemId);
    if (item) {
        item.currentStock = Math.max(0, item.currentStock - req.body.quantity);
        writeJSON('inventory.json', inventory);
    }
    
    res.json(entry);
});

// CUSTOMERS (Loyalty)
app.get('/api/customers', (req, res) => {
    res.json(readJSON('customers.json'));
});

app.get('/api/customers/phone/:phone', (req, res) => {
    const data = readJSON('customers.json');
    const customer = data.customers.find(c => c.phone === req.params.phone);
    if (customer) {
        res.json(customer);
    } else {
        res.status(404).json({ error: 'Customer not found' });
    }
});

app.post('/api/customers', (req, res) => {
    const data = readJSON('customers.json');
    const newCustomer = {
        id: `C${String(data.customers.length + 1).padStart(3, '0')}`,
        ...req.body,
        points: 0,
        totalSpent: 0,
        visits: 0,
        memberSince: new Date().toISOString().split('T')[0],
        tier: 'bronze'
    };
    data.customers.push(newCustomer);
    writeJSON('customers.json', data);
    res.json(newCustomer);
});

app.patch('/api/customers/:id', (req, res) => {
    const data = readJSON('customers.json');
    const customer = data.customers.find(c => c.id === req.params.id);
    if (customer) {
        Object.assign(customer, req.body);
        // Update tier based on points
        if (customer.points >= 1500) customer.tier = 'gold';
        else if (customer.points >= 500) customer.tier = 'silver';
        else customer.tier = 'bronze';
        writeJSON('customers.json', data);
        res.json(customer);
    } else {
        res.status(404).json({ error: 'Customer not found' });
    }
});

// Customer self-ordering page
app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'order', 'order-v2.html'));
});

// Captain Rico Rewards - Teacher Portal
app.get('/rewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'teacher-portal.html'));
});

// Captain Rico Rewards - Certificate Generator
app.get('/rewards/certificate', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'certificate.html'));
});

// Main app shell
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ☕  RICH AROMA OS  ☕                             ║
║                                                       ║
║     Server running on http://localhost:${PORT}          ║
║                                                       ║
║     Modules:                                          ║
║     • POS:        /src/pos/pos.html                   ║
║     • KDS:        /src/kds/kds.html                   ║
║     • Time Clock: /src/timeclock/timeclock.html       ║
║     • Scheduling: /src/scheduling/scheduling.html     ║
║     • Inventory:  /src/inventory/inventory.html       ║
║     • KPIs:       /src/kpis/kpis.html                 ║
║     • Loyalty:    /src/loyalty/loyalty.html           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Rico Rewards order page (v2)

// Rico Balance - Load funds
app.post('/api/customers/:id/load-balance', (req, res) => {
    const data = readJSON('customers.json');
    const customer = data.customers.find(c => c.id === req.params.id);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }
    
    const amount = parseFloat(req.body.amount) || 0;
    const bonus = Math.round(amount * 0.10); // 10% bonus
    const totalCredit = amount + bonus;
    
    customer.ricoBalance = (customer.ricoBalance || 0) + totalCredit;
    customer.totalLoaded = (customer.totalLoaded || 0) + amount;
    
    // Log the transaction
    if (!customer.balanceHistory) customer.balanceHistory = [];
    customer.balanceHistory.push({
        type: 'load',
        amount: amount,
        bonus: bonus,
        total: totalCredit,
        timestamp: new Date().toISOString()
    });
    
    writeJSON('customers.json', data);
    res.json({ 
        success: true, 
        loaded: amount, 
        bonus: bonus, 
        newBalance: customer.ricoBalance,
        customer 
    });
});

// Rico Balance - Pay with balance
app.post('/api/customers/:id/pay-balance', (req, res) => {
    const data = readJSON('customers.json');
    const customer = data.customers.find(c => c.id === req.params.id);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }
    
    const amount = parseFloat(req.body.amount) || 0;
    if ((customer.ricoBalance || 0) < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    customer.ricoBalance = (customer.ricoBalance || 0) - amount;
    
    // Log the transaction
    if (!customer.balanceHistory) customer.balanceHistory = [];
    customer.balanceHistory.push({
        type: 'payment',
        amount: -amount,
        orderId: req.body.orderId,
        timestamp: new Date().toISOString()
    });
    
    writeJSON('customers.json', data);
    res.json({ 
        success: true, 
        paid: amount, 
        newBalance: customer.ricoBalance,
        customer 
    });
});

// Rico Balance - Load Balance Page (Staff)
app.get('/load-balance', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'rewards', 'load-balance.html'));
});

// === Creator Submissions API ===

// Get all submissions (staff review)
app.get('/api/creator-submissions', (req, res) => {
    const data = readJSON('creator-submissions.json');
    res.json(data.submissions || []);
});

// Get submissions by phone (creator view)
app.get('/api/creator-submissions/phone/:phone', (req, res) => {
    const data = readJSON('creator-submissions.json');
    const phone = req.params.phone.replace(/\D/g, '');
    const submissions = (data.submissions || []).filter(s => 
        s.phone.replace(/\D/g, '') === phone
    );
    
    const approved = submissions.filter(s => s.status === 'approved');
    const totalPoints = approved.reduce((sum, s) => sum + (s.pointsAwarded || 100), 0);
    
    // Check if creator has discount code
    const creators = readJSON('creators.json');
    const creator = (creators.creators || []).find(c => c.phone.replace(/\D/g, '') === phone);
    
    res.json({
        submissions,
        totalPoints,
        totalCommission: creator?.totalCommission || 0,
        discountCode: creator?.discountCode || null,
        codeUses: creator?.codeUses || 0,
        codeSales: creator?.codeSales || 0,
        codeCommission: creator?.codeCommission || 0
    });
});

// Submit new content
app.post('/api/creator-submissions', (req, res) => {
    const data = readJSON('creator-submissions.json');
    if (!data.submissions) data.submissions = [];
    
    const { phone, platform, link, description } = req.body;
    
    // Get creator name from customers
    const customers = readJSON('customers.json');
    const customer = (customers.customers || []).find(c => 
        c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    
    const submission = {
        id: 'sub_' + Date.now(),
        phone,
        creatorName: customer?.name || null,
        platform,
        link,
        description,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        pointsAwarded: null
    };
    
    data.submissions.unshift(submission);
    writeJSON('creator-submissions.json', data);
    
    res.json({ success: true, submission });
});

// Review submission (approve/deny)
app.post('/api/creator-submissions/:id/review', (req, res) => {
    const data = readJSON('creator-submissions.json');
    const sub = (data.submissions || []).find(s => s.id === req.params.id);
    
    if (!sub) {
        return res.status(404).json({ error: 'Submission not found' });
    }
    
    const { status, pointsAwarded } = req.body;
    sub.status = status;
    sub.reviewedAt = new Date().toISOString();
    sub.pointsAwarded = status === 'approved' ? (pointsAwarded || 100) : 0;
    
    // If approved, add points to customer
    if (status === 'approved' && sub.phone) {
        const customers = readJSON('customers.json');
        const customer = (customers.customers || []).find(c => 
            c.phone.replace(/\D/g, '') === sub.phone.replace(/\D/g, '')
        );
        if (customer) {
            customer.points = (customer.points || 0) + sub.pointsAwarded;
            writeJSON('customers.json', customers);
        }
        
        // Check if creator qualifies for discount code (3+ approved)
        const approved = data.submissions.filter(s => 
            s.phone.replace(/\D/g, '') === sub.phone.replace(/\D/g, '') && 
            s.status === 'approved'
        );
        if (approved.length >= 3) {
            const creators = readJSON('creators.json');
            if (!creators.creators) creators.creators = [];
            let creator = creators.creators.find(c => 
                c.phone.replace(/\D/g, '') === sub.phone.replace(/\D/g, '')
            );
            if (!creator) {
                const name = customer?.name || 'CREATOR';
                const code = 'RICO-' + name.split(' ')[0].toUpperCase().slice(0,6);
                creator = {
                    phone: sub.phone,
                    name: customer?.name,
                    discountCode: code,
                    codeUses: 0,
                    codeSales: 0,
                    codeCommission: 0,
                    totalCommission: 0,
                    createdAt: new Date().toISOString()
                };
                creators.creators.push(creator);
                writeJSON('creators.json', creators);
            }
        }
    }
    
    writeJSON('creator-submissions.json', data);
    res.json({ success: true, submission: sub });
});

// Creator pages routes
app.get('/creators', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'creators', 'creators.html'));
});
app.get('/creators/review', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'creators', 'review.html'));
});

// === Discount Codes API ===

// Validate discount code
app.get('/api/discount-codes/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    
    // Check creator codes
    const creators = readJSON('creators.json');
    const creator = (creators.creators || []).find(c => c.discountCode === code);
    
    if (creator) {
        return res.json({
            valid: true,
            code: creator.discountCode,
            percent: 20, // 20% off for creator codes
            creatorId: creator.phone,
            creatorName: creator.name
        });
    }
    
    // Check promo codes
    const promos = readJSON('promo-codes.json');
    const promo = (promos.codes || []).find(p => p.code === code && p.active);
    
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

// Track code usage (called after order)
app.post('/api/discount-codes/:code/use', (req, res) => {
    const code = req.params.code.toUpperCase();
    const { orderTotal, discountAmount } = req.body;
    
    const creators = readJSON('creators.json');
    const creator = (creators.creators || []).find(c => c.discountCode === code);
    
    if (creator) {
        creator.codeUses = (creator.codeUses || 0) + 1;
        creator.codeSales = (creator.codeSales || 0) + orderTotal;
        // 10% commission on discounted amount
        const commission = Math.round(discountAmount * 0.5); // 50% of discount = 10% of original
        creator.codeCommission = (creator.codeCommission || 0) + commission;
        creator.totalCommission = (creator.totalCommission || 0) + commission;
        writeJSON('creators.json', creators);
        
        return res.json({ success: true, commission });
    }
    
    res.json({ success: true });
});

// === Morning Dashboard APIs ===

// X Opportunities (reads from markdown file)
app.get('/api/x-opportunities', (req, res) => {
    const fs = require('fs');
    try {
        const content = fs.readFileSync('/Users/racs/clawd/projects/x-content/reply_opportunities.md', 'utf8');
        // Parse simple format
        const opportunities = [];
        const sections = content.split('### ');
        for (const section of sections.slice(1, 4)) { // First 3
            const lines = section.split('\n');
            const titleMatch = lines[0].match(/@(\w+)/);
            const likesMatch = section.match(/(\d+(?:,\d+)?(?:\.\d+)?K?) likes/);
            const textMatch = section.match(/\*\*Tweet:\*\* "(.+?)"/s);
            const replyMatch = section.match(/```\n([\s\S]+?)```/);
            
            if (titleMatch) {
                opportunities.push({
                    author: titleMatch[1],
                    likes: likesMatch ? likesMatch[1] : '?',
                    replies: '?',
                    text: textMatch ? textMatch[1].slice(0, 150) + '...' : lines[0],
                    timeAgo: 'Recent',
                    draftReply: replyMatch ? replyMatch[1].trim().slice(0, 200) + '...' : null
                });
            }
        }
        res.json({ opportunities });
    } catch (e) {
        res.json({ opportunities: [], error: e.message });
    }
});

// Trading status
app.get('/api/trading-status', (req, res) => {
    const fs = require('fs');
    try {
        const content = fs.readFileSync('/Users/racs/clawd/projects/polymarket-trader/learning_trades.json', 'utf8');
        const data = JSON.parse(content);
        res.json({
            balance: data.balance,
            positions: data.positions,
            closedTrades: data.closed_trades
        });
    } catch (e) {
        res.json({ balance: 100, positions: [], closedTrades: [] });
    }
});

// Overnight activity
app.get('/api/overnight-activity', (req, res) => {
    try {
        const state = readJSON('/Users/racs/clawd/projects/command-center/data/state.json');
        const activity = (state.activity || []).slice(0, 6).map(a => ({
            time: new Date(a.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            text: a.text
        }));
        res.json({ activity });
    } catch (e) {
        res.json({ activity: [] });
    }
});
