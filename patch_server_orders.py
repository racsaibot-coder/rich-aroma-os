import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/server.js'

with open(file_path, 'r') as f:
    content = f.read()

login_endpoint = """
// Customer PIN Login
app.post('/api/customer/login', async (req, res) => {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ error: "Teléfono y PIN requeridos" });
    
    const cleanPhone = phone.replace(/[^\\d+]/g, '');
    
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
        res.json({ message: "Login successful", customer });
    } else {
        // First time setting PIN
        await supabase.from('customers').update({ pin }).eq('id', customer.id);
        customer.pin = pin;
        res.json({ message: "PIN creado exitosamente", customer });
    }
});
"""

if "app.post('/api/customer/login'" not in content:
    content = content.replace("app.get('/api/customer/profile'", login_endpoint + "\napp.get('/api/customer/profile'")

# Update POST /api/orders to check for PIN if rico_balance
order_api_pattern = r"app\.post\('/api/orders', async \(req, res\) => \{(.*?)(const \{ data: savedOrder, error: saveErr \} = await supabase)"

pin_validation_logic = """
    // PIN Validation for Rico Cash
    if (order.paymentMethod === 'rico_balance' || order.paymentMethod === 'split_transfer' || order.paymentMethod === 'split_cash') {
        if (!order.customerId) return res.status(400).json({ error: "Customer required for Rico Cash" });
        if (!order.pin) return res.status(401).json({ error: "PIN requerido para usar Rico Cash" });
        
        const { data: cData } = await supabase.from('customers').select('pin').eq('id', order.customerId).single();
        if (!cData || cData.pin !== order.pin) {
            return res.status(401).json({ error: "PIN incorrecto" });
        }
    }
    
    // Resume save
    const { data: savedOrder, error: saveErr } = await supabase"""

content = re.sub(r"(app\.post\('/api/orders', async \(req, res\) => \{.*?(?=const \{ data: savedOrder, error: saveErr \} = await supabase))", r"\1" + pin_validation_logic.replace('const { data: savedOrder, error: saveErr } = await supabase', '').strip() + "\n\n    const { data: savedOrder, error: saveErr } = await supabase", content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)

print("server.js updated.")
