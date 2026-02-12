// === FOUNDERS DASHBOARD API (The Ledger - SUPABASE VERSION) ===

// Helper: Get data from Supabase
const getFoundersDB = async () => {
    try {
        const { data: founders, error } = await supabase
            .from('founders')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;

        // Transform to match old JSON structure for frontend compatibility
        const confirmed = founders.filter(f => f.status === 'confirmed');
        const pending = founders.filter(f => f.status === 'pending');
        
        const revenue = confirmed.length * 1500;
        
        return {
            sold: confirmed.length,
            revenue: revenue,
            pending: pending,
            confirmed: confirmed
        };
    } catch (e) {
        console.error("Founders DB Error (Supabase):", e);
        // Fallback or empty
        return { sold: 0, revenue: 0, pending: [], confirmed: [] };
    }
};

// GET Ledger
app.get('/api/admin/founders', async (req, res) => {
    const db = await getFoundersDB();
    res.json(db);
});

// POST Manual Sale (Add Pending)
app.post('/api/admin/founders/add', async (req, res) => {
    const { name, phone, ticket, ref, status } = req.body;
    
    // Get count for ticket number
    const { count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
    
    const newEntry = {
        name, 
        phone: phone.replace(/\D/g, ''), 
        ticket: ticket || 'RA-F' + (count + 1).toString().padStart(3, '0'),
        ref_notes: ref || 'CASH',
        status: status || 'pending',
        amount: 1500
    };

    const { data, error } = await supabase.from('founders').insert(newEntry).select().single();
    
    if (error) return res.status(500).json({ error: error.message });
    
    // If auto-confirmed, trigger VIP upgrade
    if (status === 'confirmed') {
        // Trigger VIP upgrade logic (Reusing the function below would be better, but calling direct here for now)
        // ... (See verify endpoint)
    }

    res.json({ success: true, entry: data });
});

// POST Verify/Confirm
app.post('/api/admin/verify-founder', async (req, res) => {
    const { id } = req.body;
    
    // 1. Update Founder Status
    const { data: founder, error } = await supabase
        .from('founders')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    
    // 2. --- INTEGRATION: AUTO-CREATE CUSTOMER ---
    try {
        const cleanPhone = founder.phone.replace(/\D/g, '');
        
        // Check if exists
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        
        if (existing) {
            // Update to VIP
            await supabase.from('customers').update({
                is_vip: true,
                tier: 'gold', 
                notes: `FOUNDER: ${founder.ticket} (Verified)`
            }).eq('id', existing.id);
        } else {
            // Create New VIP Account
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
    } catch (err) {
        console.error("Founder Auto-Integrate Failed:", err);
    }
    
    res.json({ success: true, founder });
});
