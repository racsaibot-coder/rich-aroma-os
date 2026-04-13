// api/staff.js
const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;

    try {
        // 1. Employee Auth/Profile
        if (action === 'profile' && req.method === 'GET') {
            const { pin } = req.query;
            const { data, error } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).single();
            if (error || !data) return res.status(401).json({ error: "Invalid PIN" });
            return res.json(data);
        }

        // 2. Timeclock (In, Out, Break Start, Break End)
        if (action === 'timeclock' && req.method === 'POST') {
            const { employeeId, type, pin } = req.body;
            // Verify PIN
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

        // 3. Availability
        if (action === 'availability' && req.method === 'GET') {
            const { employeeId } = req.query;
            const { data, error } = await supabase.from('employee_availability').select('*').eq('employee_id', employeeId);
            if (error) throw error;
            return res.json(data);
        }

        if (action === 'availability' && req.method === 'POST') {
            const { employeeId, availability, pin } = req.body; // availability = [{ day_of_week, is_available, start_time, end_time }]
            const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).eq('pin', pin).single();
            if (!emp) return res.status(401).json({ error: "Unauthorized" });

            // Delete old availability and insert new
            await supabase.from('employee_availability').delete().eq('employee_id', employeeId);
            const { data, error } = await supabase.from('employee_availability').insert(
                availability.map(a => ({ ...a, employee_id: employeeId }))
            ).select();

            if (error) throw error;
            return res.json(data);
        }

        // 4. Time Off Requests
        if (action === 'time_off' && req.method === 'GET') {
            const { employeeId } = req.query;
            const { data, error } = await supabase.from('time_off_requests').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }

        if (action === 'time_off' && req.method === 'POST') {
            const { employeeId, startDate, endDate, reason, pin } = req.body;
            const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).eq('pin', pin).single();
            if (!emp) return res.status(401).json({ error: "Unauthorized" });

            const { data, error } = await supabase.from('time_off_requests').insert({
                employee_id: employeeId,
                start_date: startDate,
                end_date: endDate,
                reason: reason,
                status: 'pending'
            }).select().single();

            if (error) throw error;
            return res.json(data);
        }

        // 5. My Schedule
        if (action === 'schedule' && req.method === 'GET') {
            const { employeeId } = req.query;
            const { data, error } = await supabase.from('employee_schedules').select('*').eq('employee_id', employeeId).order('day_of_week', { ascending: true });
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Staff API Error:", e);
        res.status(500).json({ error: e.message });
    }
};
