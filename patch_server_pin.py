import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/server.js'

with open(file_path, 'r') as f:
    content = f.read()

# Add /api/customer/login endpoint
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

# Let's insert it before the /api/customer/profile endpoint
if "app.post('/api/customer/login'" not in content:
    content = content.replace("app.get('/api/customer/profile'", login_endpoint + "\napp.get('/api/customer/profile'")

# Update order creation endpoint to validate PIN if paymentMethod is rico_balance
# The order creation is likely POST /api/orders
# We need to find POST /api/orders.
