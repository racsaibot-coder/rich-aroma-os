const fs = require('fs');

const path = 'projects/rich-aroma-os/api/admin.js';
let content = fs.readFileSync(path, 'utf8');

const newCode = `
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
`;

content = content.replace("res.status(404).json({ error: 'Action not found' });\n}", newCode);

fs.writeFileSync(path, content);
console.log('admin.js patched');
