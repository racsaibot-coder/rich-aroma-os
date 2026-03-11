const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;

    if (action === 'current-shift' && req.method === 'GET') {
        const { data, error } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        // Let it pass without shift if PGRST116 (No rows found)
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        return res.json({ shift: data || null });
    }

    if (action === 'open-shift' && req.method === 'POST') {
        const { openingAmount, employeeId, pin } = req.body;
        
        let empId = employeeId;
        
        // Use PIN if passed or if employeeId is used as PIN fallback from UI
        const pinToUse = pin || employeeId; 
        
        if (pinToUse) {
            const { data: emp } = await supabase.from('employees').select('id, name').eq('pin', pinToUse).limit(1).single();
            if (!emp) return res.status(401).json({ error: 'Invalid PIN' });
            empId = emp.id;
        }

        const { data: existing } = await supabase
            .from('cash_shifts')
            .select('id')
            .eq('status', 'open')
            .single();

        if (existing) return res.status(400).json({ error: 'There is already an open shift.' });

        const { data, error } = await supabase
            .from('cash_shifts')
            .insert({
                employee_id: empId,
                opening_amount: openingAmount || 0,
                status: 'open',
                opened_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    
    if (action === 'close-shift' && req.method === 'POST') {
        const { shiftId, closingAmount, notes } = req.body;
        
        const { data: shift, error: shiftErr } = await supabase
            .from('cash_shifts')
            .select('*')
            .eq('id', shiftId)
            .single();
            
        if (shiftErr || !shift) return res.status(404).json({ error: 'Shift not found' });
        
        const { data: orders } = await supabase
            .from('orders')
            .select('total')
            .eq('payment_method', 'cash')
            .gte('created_at', shift.opened_at);
            
        const cashSales = (orders || []).reduce((sum, o) => sum + o.total, 0);
        
        const { data: txns } = await supabase
            .from('cash_transactions')
            .select('amount, type')
            .eq('shift_id', shiftId);
            
        let payouts = 0;
        let drops = 0;
        if (txns) {
            txns.forEach(t => {
                if (t.type === 'payout') payouts += t.amount;
                if (t.type === 'drop') drops += t.amount;
            });
        }
        
        const expected = shift.opening_amount + cashSales - payouts - drops;
        const diff = closingAmount - expected;
        
        const { data: updated, error: closeErr } = await supabase
            .from('cash_shifts')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closing_amount_declared: closingAmount,
                expected_amount: expected,
                discrepancy: diff,
                notes: notes
            })
            .eq('id', shiftId)
            .select()
            .single();
            
        if (closeErr) return res.status(500).json({ error: closeErr.message });
        
        return res.json({ success: true, shift: updated });
    }

    res.status(404).json({ error: 'Action not found' });
}
