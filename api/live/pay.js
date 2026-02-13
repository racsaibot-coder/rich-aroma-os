// api/live/pay.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { phone, pin } = req.body;

    // 1. Fetch Config (Stateless)
    const { data: config } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'live_drop')
        .single();
    
    // In-memory fallback if no DB config
    const currentDrop = config?.value || { active: false, stock: 0, price: 0 };

    if (!currentDrop.active || currentDrop.stock <= 0) {
        return res.status(400).json({ error: "Sold out or inactive" });
    }

    // 2. Validate User
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
    let remainingCost = price;
    let deductCredit = 0;
    let deductCash = 0;

    if (customer.membership_credit >= remainingCost) {
        deductCredit = remainingCost;
    } else {
        deductCredit = customer.membership_credit;
        deductCash = remainingCost - deductCredit;
    }

    const { error } = await supabase
        .from('customers')
        .update({
            membership_credit: customer.membership_credit - deductCredit,
            cash_balance: customer.cash_balance - deductCash
        })
        .eq('id', customer.id);

    if (error) return res.status(500).json({ error: "Transaction failed" });

    // 5. Generate Ticket & Update Stock
    const code = "RA-" + Math.floor(1000 + Math.random() * 9000);
    
    // Update DB Stock (Atomic decrement ideally, but read-update-write for now)
    const newStock = currentDrop.stock - 1;
    await supabase
        .from('system_settings')
        .update({ value: { ...currentDrop, stock: newStock } })
        .eq('key', 'live_drop');

    // Log Tx
    await supabase.from('balance_history').insert({
        customer_id: customer.id,
        type: 'payment',
        amount: -price,
        notes: `Live Drop: ${currentDrop.product}`
    });

    res.json({ success: true, code, paid: true, balance: balance - price });
}