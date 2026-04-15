// api/staff.js
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;

    try {
        // --- 1. Employee Auth/Profile ---
        if (action === 'profile' && req.method === 'GET') {
            const { pin } = req.query;
            if (!pin) return res.status(400).json({ error: "PIN is required" });
            const { data, error } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).single();
            if (error || !data) return res.status(401).json({ error: "Invalid PIN" });
            return res.json(data);
        }

        // --- 2. Timeclock ---
        if (action === 'timeclock' && req.method === 'POST') {
            const { employeeId, type, pin } = req.body;
            const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).eq('pin', pin).single();
            if (!emp) return res.status(401).json({ error: "Unauthorized" });

            const { data, error } = await supabase.from('time_entries').insert({
                employee_id: employeeId,
                type: type, // 'in', 'out', 'break_start', 'break_end'
                timestamp: new Date().toISOString()
            }).select().single();

            if (error) throw error;
            return res.json(data);
        }

        if (action === 'timeclock_status' && req.method === 'GET') {
            const { employeeId } = req.query;
            const { data, error } = await supabase
                .from('time_entries')
                .select('*')
                .eq('employee_id', employeeId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            return res.json(data || { type: 'out' });
        }

        if (action === 'timeclock_summary' && req.method === 'GET') {
            const { employeeId, startDate, endDate } = req.query;
            const { data: entries } = await supabase
                .from('time_entries')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('timestamp', startDate)
                .lte('timestamp', endDate)
                .order('timestamp', { ascending: true });

            const { data: emp } = await supabase.from('employees').select('hourly_rate').eq('id', employeeId).single();
            const hourlyRate = parseFloat(emp?.hourly_rate || 0);

            let totalMilliseconds = 0;
            let currentIn = null;
            let currentBreak = null;
            const dailyHistory = {};

            (entries || []).forEach(e => {
                const dateKey = new Date(e.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
                if (!dailyHistory[dateKey]) dailyHistory[dateKey] = { hours: 0, entries: [] };
                dailyHistory[dateKey].entries.push(e);

                if (e.type === 'in') currentIn = new Date(e.timestamp);
                else if (e.type === 'out' && currentIn) {
                    const diff = (new Date(e.timestamp) - currentIn);
                    totalMilliseconds += diff;
                    dailyHistory[dateKey].hours += (diff / (1000 * 60 * 60));
                    currentIn = null;
                } else if (e.type === 'break_start') currentBreak = new Date(e.timestamp);
                else if (e.type === 'break_end' && currentBreak && currentIn) {
                    const breakDiff = (new Date(e.timestamp) - currentBreak);
                    totalMilliseconds -= breakDiff;
                    dailyHistory[dateKey].hours -= (breakDiff / (1000 * 60 * 60));
                    currentBreak = null;
                }
            });

            const totalHours = totalMilliseconds / (1000 * 60 * 60);
            return res.json({
                totalHours: totalHours.toFixed(2),
                estimatedPay: (totalHours * hourlyRate).toFixed(2),
                hourlyRate: hourlyRate,
                dailyHistory: dailyHistory
            });
        }

        // --- 3. Availability ---
        if (action === 'availability' && req.method === 'GET') {
            const { employeeId } = req.query;
            const { data, error } = await supabase.from('employee_availability').select('*').eq('employee_id', employeeId);
            if (error) throw error;
            return res.json(data);
        }

        if (action === 'availability' && req.method === 'POST') {
            const { employeeId, availability, pin } = req.body;
            const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).eq('pin', pin).single();
            if (!emp) return res.status(401).json({ error: "Unauthorized" });

            await supabase.from('employee_availability').delete().eq('employee_id', employeeId);
            const { data, error } = await supabase.from('employee_availability').insert(
                availability.map(a => ({ ...a, employee_id: employeeId }))
            ).select();

            if (error) throw error;
            return res.json(data);
        }

        // --- 4. Admin Actions ---
        const isAdminAction = action.startsWith('admin_');
        if (isAdminAction) {
            const { adminId, adminPin } = req.query.adminId ? req.query : req.body;
            const { data: admin } = await supabase.from('employees').select('is_admin, role').eq('id', adminId).eq('pin', adminPin).single();
            const isAdmin = admin && (admin.is_admin === true || admin.role?.toLowerCase() === 'admin');
            
            if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

            if (action === 'admin_all_employees') {
                const { data } = await supabase.from('employees').select('*').eq('active', true).order('name');
                return res.json(data || []);
            }

            if (action === 'admin_payroll_summary') {
                const { startDate, endDate } = req.query;
                const { data: emps } = await supabase.from('employees').select('id, name, hourly_rate').eq('active', true);
                const { data: allEntries } = await supabase.from('time_entries').select('*').gte('timestamp', startDate).lte('timestamp', endDate);

                const report = emps.map(emp => {
                    const entries = allEntries.filter(e => e.employee_id === emp.id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                    let ms = 0;
                    let curIn = null;
                    let curBrk = null;
                    entries.forEach(e => {
                        if (e.type === 'in') curIn = new Date(e.timestamp);
                        else if (e.type === 'out' && curIn) { ms += (new Date(e.timestamp) - curIn); curIn = null; }
                        else if (e.type === 'break_start') curBrk = new Date(e.timestamp);
                        else if (e.type === 'break_end' && curBrk && curIn) { ms -= (new Date(e.timestamp) - curBrk); curBrk = null; }
                    });
                    const hrs = ms / (1000 * 60 * 60);
                    return {
                        id: emp.id,
                        name: emp.name,
                        hours: hrs.toFixed(2),
                        pay: (hrs * parseFloat(emp.hourly_rate || 0)).toFixed(2)
                    };
                });
                return res.json(report);
            }

            if (action === 'admin_shift_assignments') {
                if (req.method === 'GET') {
                    const { startDate, endDate } = req.query;
                    const { data } = await supabase.from('shift_assignments').select('*, employees(name)').gte('shift_date', startDate).lte('shift_date', endDate);
                    return res.json(data);
                }
                if (req.method === 'POST') {
                    const { assignments } = req.body;
                    const { data, error } = await supabase.from('shift_assignments').upsert(assignments).select();
                    if (error) throw error;
                    return res.json(data);
                }
                if (req.method === 'DELETE') {
                    const { id } = req.body;
                    await supabase.from('shift_assignments').delete().eq('id', id);
                    return res.json({ success: true });
                }
            }
        }

        if (action === 'my_shifts' && req.method === 'GET') {
            const { employeeId, startDate, endDate } = req.query;
            const { data, error } = await supabase.from('shift_assignments').select('*').eq('employee_id', employeeId).gte('shift_date', startDate).lte('shift_date', endDate).order('shift_date', { ascending: true });
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Staff API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
