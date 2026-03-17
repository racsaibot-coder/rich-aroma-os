// api/admin.js
const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id } = req.query; // ?action=founders, ?action=verify-founder

    // SECURE ADMIN ENDPOINTS

    // MENU MANAGER (GET ALL, PATCH, POST)
    if (action === 'menu' && req.method === 'GET') {
        const { data } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
        return res.json({ items: data });
    }

    if (action === 'menu' && req.method === 'POST') {
        const { name, category, price, available, image_url, modifier_groups } = req.body;
        const id = category.toLowerCase() + '_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const { data, error } = await supabase.from('menu_items')
            .insert({ id, name, category, price, available, image_url, modifier_groups: modifier_groups || [] })
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'menu_update' && (req.method === 'PATCH' || req.method === 'PUT')) {
        const { id, price, available, image_url, name, category, modifier_groups } = req.body;
        const updateData = { price, available, image_url };
        if (name) updateData.name = name;
        if (category) updateData.category = category;
        
        const itemId = req.query.id || id;
        const { data, error } = await supabase.from('menu_items')
            .update(updateData)
            .eq('id', itemId)
            .select().single();
            
        if (error) return res.status(500).json({ error: error.message });
        
        if (modifier_groups) {
            await supabase.from('item_modifier_groups').delete().eq('item_id', itemId);
            if (modifier_groups.length > 0) {
                const inserts = modifier_groups.map(groupId => ({
                    item_id: itemId,
                    group_id: groupId,
                    display_order: 1
                }));
                await supabase.from('item_modifier_groups').insert(inserts);
            }
        }
        return res.json(data);
    }

    if (action === 'menu_update' && req.method === 'DELETE') {
        const itemId = req.query.id;
        const { error } = await supabase.from('menu_items')
            .delete()
            .eq('id', itemId);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // MODIFIER MANAGER
    if (action === 'modifiers' && req.method === 'GET') {
        const { data: modGroups } = await supabase.from('modifier_groups').select('*');
        const { data: modOptions } = await supabase.from('modifier_options').select('*');
        return res.json({ modGroups, modOptions });
    }

    if (action === 'modifier_option_update' && req.method === 'PATCH') {
        const { id, price_adjustment } = req.body;
        const { data, error } = await supabase.from('modifier_options')
            .update({ price_adjustment })
            .eq('id', id)
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    
    if (action === 'modifiers_group_create' && req.method === 'POST') {
        const { name, max_selections, required } = req.body;
        const { data, error } = await supabase.from('modifier_groups').insert({ name, max_selections, required }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    
    if (action === 'modifiers_option_create' && req.method === 'POST') {
        const { group_id, name, price_adjustment, is_default } = req.body;
        const { data, error } = await supabase.from('modifier_options').insert({ group_id, name, price_adjustment, is_default }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'modifier_option_delete' && req.method === 'DELETE') {
        const { id } = req.query;
        const { error } = await supabase.from('modifier_options').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    if (action === 'kpi' && req.method === 'GET') {
        // Fetch today's orders
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const { data: orders, error } = await supabase.from('orders')
            .select('total, status, items, created_at')
            .gte('created_at', today.toISOString());
            
        if (error) return res.status(500).json({ error: error.message });

        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'paid');
        const revenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const orderCount = completedOrders.length;
        
        // Items sold count
        let itemsSold = 0;
        completedOrders.forEach(o => {
            if(o.items) {
                o.items.forEach(i => itemsSold += (i.qty || 1));
            }
        });

        return res.json({
            todayRevenue: revenue,
            todayOrders: orderCount,
            todayItemsSold: itemsSold,
            orders: completedOrders.slice(0, 20) // recent 20 for feed
        });
    }

    // TIMECLOCK
    if (action === 'timeclock' && req.method === 'POST') {
        const { pin, type } = req.body; // type = 'in' or 'out'
        
        // Find employee by PIN
        const { data: emp, error: empErr } = await supabase.from('employees').select('id, name').eq('pin', pin).single();
        if (empErr || !emp) return res.status(401).json({ error: 'Invalid PIN' });

        const { data, error } = await supabase.from('time_entries').insert({
            employee_id: emp.id,
            type: type,
            timestamp: new Date().toISOString()
        }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, employee: emp.name, type });
    }

    if (action === 'timeclock_status' && req.method === 'GET') {
        // Get latest punch for all employees today
        const today = new Date();
        today.setHours(0,0,0,0);
        const { data, error } = await supabase.from('time_entries')
            .select('employee_id, type, timestamp, employees(name)')
            .gte('timestamp', today.toISOString())
            .order('timestamp', { ascending: false });
            
        if (error) return res.status(500).json({ error: error.message });
        
        // Group by employee to find current status
        const statusMap = {};
        if (data) {
            data.forEach(entry => {
                if (!statusMap[entry.employee_id]) {
                    statusMap[entry.employee_id] = {
                        name: entry.employees?.name,
                        status: entry.type === 'in' ? 'Clocked In' : 'Clocked Out',
                        time: entry.timestamp
                    };
                }
            });
        }
        
        return res.json({ active: Object.values(statusMap) });
    }
    if (action === 'founders' && req.method === 'GET') {
        const { data: founders } = await supabase.from('founders').select('*').order('created_at', { ascending: false });
        const confirmed = (founders || []).filter(f => f.status === 'confirmed');
        const pending = (founders || []).filter(f => f.status === 'pending');
        return res.json({ sold: confirmed.length, revenue: confirmed.length * 1500, pending, confirmed });
    }

    // ADD FOUNDER
    if (action === 'founders' && req.method === 'POST') {
        const { name, phone, ref, status } = req.body;
        const { count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
        const ticket = 'RA-F' + ((count || 0) + 1).toString().padStart(3, '0');
        const { data, error } = await supabase.from('founders').insert({
            name, phone: phone.replace(/\D/g, ''), ticket, ref_notes: ref || 'CASH', status: status || 'pending', amount: 1500
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, entry: data });
    }

    // DELETE FOUNDER
    if (action === 'founders' && req.method === 'DELETE' && id) {
        const { error } = await supabase.from('founders').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // VERIFY FOUNDER
    if (action === 'verify-founder' && req.method === 'POST') {
        const { id } = req.body;
        const { data: founder } = await supabase.from('founders').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', id).select().single();
        
        // Upgrade Customer
        const cleanPhone = founder.phone.replace(/\D/g, '');
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).single();
        if (existing) {
            await supabase.from('customers').update({ is_vip: true, tier: 'gold', notes: `FOUNDER: ${founder.ticket}` }).eq('id', existing.id);
        } else {
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;
            await supabase.from('customers').insert({ id: newId, name: founder.name, phone: cleanPhone, tier: 'gold', is_vip: true, points: 500, notes: `FOUNDER: ${founder.ticket}` });
        }
        return res.json({ success: true, founder });
    }

    
    // EMPLOYEES
    if (action === 'employees' && req.method === 'GET') {
        const { data } = await supabase.from('employees').select('*').order('name');
        return res.json({ employees: data || [] });
    }

    if (action === 'employees' && req.method === 'POST') {
        const emp = {
            id: 'emp_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: req.body.name,
            role: req.body.role || 'barista',
            pin: req.body.pin,
            hourly_rate: req.body.hourly_rate || 0,
            color: req.body.color || '#D4A574',
            active: req.body.active !== false
        };
        const { data, error } = await supabase.from('employees').insert(emp).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'employee_update' && (req.method === 'PUT' || req.method === 'PATCH')) {
        const { data, error } = await supabase.from('employees')
            .update(req.body)
            .eq('id', req.query.id)
            .select().single();
        if (error) return res.status(404).json({ error: 'Employee not found' });
        return res.json(data);
    }

    // LEADS
    if (action === 'leads' && req.method === 'GET') {
        const { data: customers } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        
        let submissions = [];
        try {
            const fs = require('fs');
            const p = require('path');
            const dbPath = p.join(process.cwd(), 'data', 'coloring-submissions.json');
            if (fs.existsSync(dbPath)) {
                submissions = JSON.parse(fs.readFileSync(dbPath, 'utf8')).submissions;
            }
        } catch (e) {}
        
        const leads = (customers || []).map(c => {
            const sub = submissions.find(s => s.phone === c.phone);
            return {
                name: c.name,
                phone: c.phone,
                kidName: sub?.kidName || null,
                image: sub?.image || null,
                tags: c.tags,
                created_at: c.created_at || (sub?.submittedAt)
            };
        });
        
        return res.json(leads);
    }

    res.status(404).json({ error: 'Action not found' });
}
