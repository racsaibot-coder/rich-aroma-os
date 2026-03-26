const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'api', 'admin.js');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("action === 'menu_item_modifiers'")) {
    const patch = `
    if (action === 'menu_item_modifiers' && req.method === 'GET') {
        const { id } = req.query;
        const { data, error } = await supabase.from('item_modifier_groups').select('group_id').eq('item_id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ itemModGroups: data || [] });
    }

    if (action === 'menu_item_modifiers' && req.method === 'POST') {
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
`;
    code = code.replace("if (action === 'modifiers' && req.method === 'GET') {", patch + "\n    if (action === 'modifiers' && req.method === 'GET') {");
    fs.writeFileSync(file, code);
    console.log("Patched Vercel api/admin.js");
} else {
    console.log("Already patched.");
}
