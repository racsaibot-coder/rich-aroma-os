const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

const caliRoutes = `
// ==========================================
// CALI DISTRO API ROUTES
// ==========================================

app.get('/api/cali/products', async (req, res) => {
    const { data, error } = await supabase.from('cali_products').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/cali/products', requireAdmin, async (req, res) => {
    const { data, error } = await supabase.from('cali_products').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/cali/products/:id', requireAdmin, async (req, res) => {
    const { data, error } = await supabase.from('cali_products').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/cali/products/:id', requireAdmin, async (req, res) => {
    const { error } = await supabase.from('cali_products').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/api/cali/locations', async (req, res) => {
    const { data, error } = await supabase.from('cali_locations').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/cali/orders', requireAdmin, async (req, res) => {
    const { data, error } = await supabase.from('cali_orders').select('*, cali_locations(*)').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
`;

if (!code.includes('/api/cali/products')) {
    code += caliRoutes;
    fs.writeFileSync(serverFile, code);
    console.log("Cali routes added to server.js");
} else {
    console.log("Cali routes already exist");
}
