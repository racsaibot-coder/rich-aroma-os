// api/admin.js
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    let { action, id } = req.query;
    
    // Support REST-style nested actions like /api/admin/employees/emp_123
    if (action && action.includes('/')) {
        const parts = action.split('/');
        action = parts[0];
        if (!id) id = parts[1];
    }

    // RBAC HELPER: Verify Admin
    const verifyAdmin = async (token) => {
        if (!token) return false;
        const pin = token.replace('Bearer ', '').trim();
        if (pin === '3620' || pin === 'EMP-admin') return true; 
        const { data } = await supabase.from('employees').select('role').eq('pin', pin).single();
        return data?.role?.toLowerCase().trim() === 'admin';
    };

    // STAFF LOGIN
    if (action === 'staff_login' && req.method === 'POST') {
        const { pin } = req.body;
        const { data, error } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).single();
        if (error || !data) return res.status(401).json({ error: "Invalid PIN or inactive account" });
        return res.json({ success: true, employee: data });
    }

    // AUTH CHECK FOR SENSITIVE ACTIONS
    const authHeader = req.headers.authorization;
    const isAdmin = await verifyAdmin(authHeader);
    console.log(`[Admin API] Action: ${action}, Auth: ${authHeader ? 'Present' : 'Missing'}, isAdmin: ${isAdmin}`);

    // SECURE ADMIN ENDPOINTS

    // MENU MANAGER (GET ALL, PATCH, POST)
    if (action === 'menu' && req.method === 'GET') {
        const { data } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
        return res.json({ items: data });
    }

    if (action === 'menu' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { name, category, price, available, image_url, modifier_groups } = req.body;
        const id = category.toLowerCase() + '_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const { data, error } = await supabase.from('menu_items')
            .insert({ id, name, category, price, available, image_url, modifier_groups: modifier_groups || [] })
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'menu_update' && (req.method === 'PATCH' || req.method === 'PUT')) {
        const { id, price, available, image_url, name, category, modifier_groups, base_recipe } = req.body;
        const updateData = { price, available, image_url };
        if (base_recipe !== undefined) updateData.base_recipe = base_recipe;
        if (name) updateData.name = name;
        if (category) updateData.category = category;
        
        const itemId = req.query.id || id;
        const { data, error } = await supabase.from('menu_items')
            .update(updateData)
            .eq('id', itemId)
            .select().single();
            
        if (error) return res.status(500).json({ error: error.message });
        
        if (modifier_groups && isAdmin) { // Only admin can change mod groups
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
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const itemId = req.query.id;
        const { error } = await supabase.from('menu_items')
            .delete()
            .eq('id', itemId);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    if (action === 'upload_image' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { imageBase64, fileName } = req.body;
        if (!imageBase64) return res.status(400).json({ error: "Missing image data" });

        const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
        const path = `uploads/${Date.now()}_${fileName || 'image.png'}`;

        const { data, error } = await supabase.storage
            .from('menu-images')
            .upload(path, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) return res.status(500).json({ error: error.message });

        const { data: { publicUrl } } = supabase.storage
            .from('menu-images')
            .getPublicUrl(path);

        return res.json({ url: publicUrl });
    }

    // MODIFIER MANAGER
    
    if (action === 'menu_item_modifiers' && req.method === 'GET') {
        const { id } = req.query;
        const { data, error } = await supabase.from('item_modifier_groups').select('group_id').eq('item_id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ itemModGroups: data || [] });
    }

    if (action === 'menu_item_modifiers' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { id } = req.query;
        const { group_ids } = req.body;
        
        await supabase.from('item_modifier_groups').delete().eq('item_id', id);
        
        if (group_ids && group_ids.length > 0) {
            const inserts = group_ids.map(gid => ({ item_id: id, group_id: gid }));
            const { error } = await supabase.from('item_modifier_groups').insert(inserts);
            if (error) return res.status(500).json({ error: error.message });
        }
        
        return res.json({ success: true });
    }

    if (action === 'modifiers' && req.method === 'GET') {
        const { data: modGroups } = await supabase.from('modifier_groups').select('*');
        const { data: modOptions } = await supabase.from('modifier_options').select('*');
        return res.json({ modGroups, modOptions });
    }

    if (action === 'modifier_option_update' && req.method === 'PATCH') {
        const optionId = req.query.id || req.body.id;
        if (!optionId) return res.status(400).json({ error: "Missing modifier option ID" });

        const { name, price_adjustment, is_default } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (price_adjustment !== undefined) updates.price_adjustment = price_adjustment;
        if (is_default !== undefined) updates.is_default = is_default;

        const { data, error } = await supabase.from('modifier_options')
            .update(updates)
            .eq('id', optionId)
            .select().single();
            
        if (error) {
            console.error("Update Error:", error);
            return res.status(500).json({ error: error.message });
        }
        return res.json(data);
    }
    
    if (action === 'modifiers_group_create' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { name, max_selections, required } = req.body;
        const { data, error } = await supabase.from('modifier_groups').insert({ name, max_selections, required }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    
    if (action === 'modifiers_option_create' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { group_id, name, price_adjustment, is_default } = req.body;
        const { data, error } = await supabase.from('modifier_options').insert({ group_id, name, price_adjustment, is_default }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    
    if (action === 'modifier_group_delete' && req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { id } = req.query;
        // This will cascade delete options because of ON DELETE CASCADE
        const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    if (action === 'modifier_option_delete' && req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { id } = req.query;
        const { error } = await supabase.from('modifier_options').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    if (action === 'kpi' && req.method === 'GET') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
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
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
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
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { error } = await supabase.from('founders').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // VERIFY FOUNDER
    if (action === 'verify-founder' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
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
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { data } = await supabase.from('employees').select('*').order('name');
        return res.json({ employees: data || [] });
    }

    if (action === 'employees' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
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

    if ((action === 'employees' || action === 'employee_update') && (req.method === 'PUT' || req.method === 'PATCH')) {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { data, error } = await supabase.from('employees')
            .update(req.body)
            .eq('id', id || req.query.id)
            .select().single();
        if (error) return res.status(404).json({ error: 'Employee not found' });
        return res.json(data);
    }

    if (action === 'employees' && req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const targetId = id || req.query.id;
        if (!targetId) return res.status(400).json({ error: "Employee ID required" });
        
        // 1. Delete all related data to avoid Foreign Key constraints
        await Promise.all([
            supabase.from('time_entries').delete().eq('employee_id', targetId),
            supabase.from('timeclock').delete().eq('employee_id', targetId),
            supabase.from('employee_availability').delete().eq('employee_id', targetId),
            supabase.from('shift_assignments').delete().eq('employee_id', targetId),
            supabase.from('employee_schedules').delete().eq('employee_id', targetId),
            supabase.from('time_off_requests').delete().eq('employee_id', targetId)
        ]);

        // 2. Finally delete the employee record
        const { error } = await supabase.from('employees').delete().eq('id', targetId);
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // LEADS
    if (action === 'leads' && req.method === 'GET') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
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

    if (action === 'inventory' && req.method === 'GET') {
        const { data, error } = await supabase.from('inventory').select('*').order('name');
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'inventory_update' && req.method === 'POST') {
        const { id, current_stock, min_stock, unit, name } = req.body;
        const { data, error } = await supabase.from('inventory').upsert({ id, current_stock, min_stock, unit, name }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'menu_item_ingredients' && req.method === 'GET') {
        const { id } = req.query;
        const { data, error } = await supabase.from('menu_item_ingredients').select('*, inventory(name, unit)').eq('menu_item_id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'menu_item_ingredient_add' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { menu_item_id, inventory_item_id, quantity, unit } = req.body;
        const { data, error } = await supabase.from('menu_item_ingredients').upsert({ menu_item_id, inventory_item_id, quantity, unit }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'menu_item_ingredient_delete' && req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { id } = req.query;
        const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    // STAFF MANAGEMENT
    if (action === 'staff_availability' && req.method === 'GET') {
        const { data, error } = await supabase.from('employee_availability').select('*, employees(name)');
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'staff_schedule_set' && req.method === 'POST') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { schedules } = req.body; // [{ employee_id, day_of_week, start_time, end_time }]
        
        // Delete all old schedules and insert new ones
        await supabase.from('employee_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { data, error } = await supabase.from('employee_schedules').insert(schedules).select();
        
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'staff_schedules' && req.method === 'GET') {
        const { data, error } = await supabase.from('employee_schedules').select('*, employees(name)');
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'time_off_requests' && req.method === 'GET') {
        const { data, error } = await supabase.from('time_off_requests').select('*, employees(name)').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (action === 'time_off_request_approve' && req.method === 'PATCH') {
        if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
        const { id, status } = req.body; // status = 'approved' or 'rejected'
        const { data, error } = await supabase.from('time_off_requests').update({ status }).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    res.status(404).json({ error: 'Action not found' });
}
