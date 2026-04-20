// api/staff.js
const { supabase } = require('./lib/supabase');

const HONDURAS_TZ = 'America/Tegucigalpa';
function getHondurasDate() {
    try {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: HONDURAS_TZ, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());
    } catch(e) {
        return new Date().toISOString().split('T')[0];
    }
}

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
            const response = data || { type: 'out' };
            return res.json({ ...response, serverTime: new Date().toISOString() });
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
            const adminPin = req.query.adminPin || req.body.adminPin || req.query.adminId;
            const cleanPin = (adminPin || '').toString().replace('Bearer ', '').trim();
            
            console.log(`[Admin Auth Attempt] Action: ${action}, PIN: ${cleanPin ? '****' : 'MISSING'}`);

            // 1. "GOD MODE" BYPASS FOR OSCAR
            if (cleanPin === '4574') {
                console.log("[Admin Auth] Oscar Super-Admin Bypass Triggered");
            } else {
                // 2. Normal database check
                const { data: admin, error: authError } = await supabase.from('employees')
                    .select('id, name, is_admin, role')
                    .eq('pin', cleanPin)
                    .eq('active', true)
                    .single();
                
                const isAdmin = admin && (
                    admin.is_admin === true || 
                    admin.role?.toLowerCase().includes('admin') ||
                    admin.role?.toLowerCase().includes('gerente')
                );
                
                if (!isAdmin) {
                    console.log(`[Admin Auth] Access Denied for PIN: ${cleanPin}`);
                    return res.status(403).json({ error: "Admin access required" });
                }
            }

            if (action === 'admin_all_employees') {
                const { data } = await supabase.from('employees').select('*').eq('active', true).order('name');
                return res.json(data || []);
            }

            if (action === 'admin_staff_availability') {
                const { data, error } = await supabase.from('employee_availability').select('*, employees(name)');
                if (error) return res.status(500).json({ error: error.message });
                return res.json(data || []);
            }

            if (action === 'admin_live_status') {
                const { data: emps } = await supabase.from('employees').select('id, name').eq('active', true).order('name');
                const { data: punches } = await supabase.from('time_entries')
                    .select('employee_id, type, timestamp')
                    .order('timestamp', { ascending: false });
                
                const report = emps.map(e => {
                    const lastPunch = punches.find(p => p.employee_id === e.id);
                    let status = 'out';
                    if (lastPunch) {
                        if (lastPunch.type === 'in' || lastPunch.type === 'break_end') status = 'in';
                        else if (lastPunch.type === 'break_start') status = 'break';
                    }
                    return {
                        id: e.id,
                        name: e.name,
                        status,
                        last_punch: lastPunch?.timestamp
                    };
                });
                return res.json(report);
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
                        hours: hrs.toFixed(1),
                        pay: (hrs * parseFloat(emp.hourly_rate || 0)).toFixed(0)
                    };
                });
                return res.json(report);
            }

            if (action === 'staff_time_off_request' && req.method === 'POST') {
                const { employee_id, startDate, endDate, reason } = req.body;
                const { data, error } = await supabase.from('time_off_requests').insert({
                    employee_id,
                    start_date: startDate,
                    end_date: endDate,
                    reason,
                    status: 'pending'
                }).select().single();
                if (error) throw error;
                return res.json(data);
            }

            if (action === 'admin_reports') {
                const todayDate = new Date();
                const today = getHondurasDate();
                const startDay = today + 'T00:00:00-06:00';
                const endDay = today + 'T23:59:59-06:00';

                // --- PAYROLL DATE LOGIC ---
                // Pay week is Sunday - Saturday. Today is Sunday (Day 0).
                const dayOfWeek = todayDate.getDay(); 
                
                // 1. Current Week (Starts Today/Sunday)
                const currentSun = new Date(todayDate);
                currentSun.setDate(todayDate.getDate() - dayOfWeek);
                const currentWeekStart = currentSun.toISOString().split('T')[0] + 'T00:00:00-06:00';

                // 2. Last Week (The one to be paid today)
                const lastSun = new Date(currentSun);
                lastSun.setDate(currentSun.getDate() - 7);
                const lastWeekStart = lastSun.toISOString().split('T')[0] + 'T00:00:00-06:00';
                const lastWeekEnd = currentSun.toISOString().split('T')[0] + 'T00:00:00-06:00'; // Today's start

                // Fetch Data
                const [rOrders, rEntries, rEmps, rCurrentWEntries, rLastWEntries] = await Promise.all([
                    supabase.from('orders').select('*').gte('created_at', startDay).lte('created_at', endDay).not('status', 'eq', 'cancelled'),
                    supabase.from('time_entries').select('*, employees(name)').gte('timestamp', startDay).lte('timestamp', endDay),
                    supabase.from('employees').select('*').eq('active', true),
                    supabase.from('time_entries').select('*, employees(name)').gte('timestamp', currentWeekStart).lte('timestamp', endDay),
                    supabase.from('time_entries').select('*, employees(name)').gte('timestamp', lastWeekStart).lt('timestamp', lastWeekEnd)
                ]);

                const orders = rOrders.data || [];
                const entries = rEntries.data || [];
                const emps = rEmps.data || [];
                const currentWeekEntries = rCurrentWEntries.data || [];
                const lastWeekEntries = rLastWEntries.data || [];

                // Helper to calc sales breakdown
                const calcBreakdown = (orderList) => {
                    const stats = { total: 0, cash: 0, card: 0, rico: 0, transfer: 0, count: orderList.length };
                    orderList.forEach(o => {
                        const t = parseFloat(o.total) || 0;
                        const rp = parseFloat(o.rico_amount_paid) || 0;
                        stats.total += t;
                        stats.rico += rp;
                        const method = o.secondary_payment_method || o.payment_method;
                        if (method === 'cash') stats.cash += (t - rp);
                        else if (method === 'card') stats.card += (t - rp);
                        else if (method === 'transfer') stats.transfer += (t - rp);
                    });
                    return stats;
                };

                const sales = calcBreakdown(orders);

                // Helper to calc earnings
                const calcEarnings = (empEntries, hourlyRate, includeLive = false) => {
                    let ms = 0; let curIn = null;
                    empEntries.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(e => {
                        if (e.type === 'in') curIn = new Date(e.timestamp);
                        else if (e.type === 'out' && curIn) { ms += (new Date(e.timestamp) - curIn); curIn = null; }
                    });
                    if (includeLive && curIn) ms += (new Date() - curIn);
                    const hrs = ms / (1000 * 60 * 60);
                    return { hours: hrs.toFixed(1), earnings: (hrs * hourlyRate).toFixed(0) };
                };

                // Labor Detail (Daily + Weekly)
                const labor = await Promise.all(emps.map(async (emp) => {
                    const empToday = entries.filter(e => e.employee_id === emp.id);
                    const empCurrW = currentWeekEntries.filter(e => e.employee_id === emp.id);
                    const empLastW = lastWeekEntries.filter(e => e.employee_id === emp.id);
                    
                    const rate = parseFloat(emp.hourly_rate || 0);
                    const daily = calcEarnings(empToday, rate, true);
                    const currW = calcEarnings(empCurrW, rate, true);
                    const lastW = calcEarnings(empLastW, rate, false);

                    const { data: schedule } = await supabase.from('shift_assignments')
                        .select('start_time, end_time, notes')
                        .eq('employee_id', emp.id)
                        .eq('shift_date', today)
                        .maybeSingle();

                    const lastPunch = empToday.length > 0 ? empToday.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null;

                    return {
                        id: emp.id, name: emp.name, role: emp.role, schedule,
                        currentStatus: lastPunch ? lastPunch.type : 'out',
                        totalHours: daily.hours,
                        payToday: daily.earnings,
                        payLastWeek: lastW.earnings,
                        payCurrentWeek: currW.earnings,
                        punches: empToday.map(e => ({ type: e.type, time: e.timestamp }))
                    };
                }));

                const totalPayoutToday = labor.reduce((s,l) => s + parseFloat(l.payLastWeek), 0);

                // --- WEEKLY SALES & PROFITS ---
                const { data: rWeeklyOrders } = await supabase.from('orders')
                    .select('*')
                    .gte('created_at', currentWeekStart)
                    .lte('created_at', endDay)
                    .not('status', 'eq', 'cancelled');
                
                const weeklySales = calcBreakdown(rWeeklyOrders || []);
                const weeklyLabor = labor.map(l => ({ id: l.id, name: l.name, hours: l.totalHours, earnings: l.payCurrentWeek }));

                // Profit Estimates
                const COGS_PCT = 0.40;
                const FIXED_DAILY = 200;
                const laborCostDay = labor.reduce((s,l) => s + parseFloat(l.payToday || 0), 0);
                const laborCostWeek = labor.reduce((s,l) => s + parseFloat(l.payCurrentWeek || 0), 0);
                
                const dayGrossProfit = sales.total * (1 - COGS_PCT);
                const dayNetProfit = dayGrossProfit - laborCostDay - FIXED_DAILY;

                const weekGrossProfit = weeklySales.total * (1 - COGS_PCT);
                const weekNetProfit = weekGrossProfit - laborCostWeek - (FIXED_DAILY * 7);

                // 2. Top Items
                const itemMap = {};
                orders.forEach(o => {
                    (o.items || []).forEach(i => {
                        const name = i.name || 'Unknown';
                        itemMap[name] = (itemMap[name] || 0) + (i.qty || 1);
                    });
                });
                const topItems = Object.entries(itemMap).map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty - a.qty).slice(0, 5);

                return res.json({ 
                    sales, 
                    weeklySales,
                    labor, 
                    weeklyLabor,
                    payoutToday: totalPayoutToday.toFixed(0),
                    topItems,
                    orders: orders.map(o => ({
                        id: o.id, order_number: o.order_number, total: o.total, payment_method: o.payment_method, notes: o.notes, created_at: o.created_at, status: o.status
                    })),
                    profits: { 
                        day: dayNetProfit.toFixed(0), 
                        week: weekNetProfit.toFixed(0) 
                    },
                    metrics: { 
                        avgSpeed: 0, 
                        completed: orders.filter(o => o.status === 'completed').length 
                    } 
                });
            }

            if (action === 'admin_time_entries') {
                if (req.method === 'GET') {
                    const { employeeId, startDate, endDate } = req.query;
                    let query = supabase.from('time_entries').select('*, employees(name)').order('timestamp', { ascending: false });
                    if (employeeId) query = query.eq('employee_id', employeeId);
                    if (startDate) query = query.gte('timestamp', startDate);
                    if (endDate) query = query.lte('timestamp', endDate);
                    
                    const { data, error } = await query;
                    if (error) throw error;
                    return res.json(data);
                }
                if (req.method === 'POST') {
                    const { employee_id, type, timestamp } = req.body;
                    const { data, error } = await supabase.from('time_entries').insert({ employee_id, type, timestamp }).select().single();
                    if (error) throw error;
                    return res.json(data);
                }
                if (req.method === 'PUT') {
                    const { id, type, timestamp } = req.body;
                    const { data, error } = await supabase.from('time_entries').update({ type, timestamp }).eq('id', id).select().single();
                    if (error) throw error;
                    return res.json(data);
                }
                if (req.method === 'DELETE') {
                    const { id } = req.body;
                    const { error } = await supabase.from('time_entries').delete().eq('id', id);
                    if (error) throw error;
                    return res.json({ success: true });
                }
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
