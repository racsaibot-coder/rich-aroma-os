const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

const app = express();

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth Middleware
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return next();

        const token = authHeader.split(' ')[1];
        if (!token) return next();

        // Admin PIN bypass
        if (token === '4574' || token === '3620' || token === 'EMP-admin' || token === 'TEST_TOKEN_ADMIN') {
            req.user = { id: 'admin', role: 'admin', email: 'admin@richaroma.com' };
            req.supabase = supabase;
            return next();
        }

        // Supabase Token Check
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            req.user = user;
            try {
                req.supabase = createClient(supabaseUrl, supabaseKey, {
                    global: { headers: { Authorization: `Bearer ${token}` } }
                });
            } catch (e) { req.supabase = supabase; }
        }
        next();
    } catch (e) {
        console.error("Auth Error:", e);
        next();
    }
};

app.use(requireAuth);

// Routes
app.get('/api/cash/current-shift', async (req, res) => {
    try {
        const { data: shift } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        res.json({ shift });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/menu', async (req, res) => {
    // Basic redirect to store API to keep it small
    res.redirect(`/api/store?action=menu&${new URLSearchParams(req.query).toString()}`);
});

const storeHandler = require('./api/store.js');
app.all('/api/store', async (req, res) => { try { await storeHandler(req, res); } catch(e) { res.status(500).json({error: e.message}); } });

const whatsappHandler = require('./api/whatsapp-webhook.js');
app.all('/api/whatsapp-webhook', async (req, res) => { try { await whatsappHandler(req, res); } catch(e) { res.status(500).json({error: e.message}); } });

const caliHandler = require('./api/cali.js');
app.all('/api/cali', async (req, res) => { 
    try { 
        // Emulate Vercel's req.query action binding from subroutes if needed
        if (req.params[0]) {
            req.query.action = req.params[0];
        }
        await caliHandler(req, res); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    } 
});

const checkoutHandler = require('./api/checkout.js');
app.all('/api/checkout', async (req, res) => { try { await checkoutHandler(req, res); } catch(e) { res.status(500).json({error: e.message}); } });

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/pos-v2', (req, res) => res.sendFile(path.join(__dirname, 'public/pos-v2.html')));
app.get('/cali/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/cali/admin.html')));
app.get('/cali/pos', (req, res) => res.sendFile(path.join(__dirname, 'public/cali/pos.html')));

module.exports = app;
