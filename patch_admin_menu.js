const fs = require('fs');

// Patch server.js
let serverCode = fs.readFileSync('server.js', 'utf8');
const serverUpdate = `
app.put('/api/admin/menu/:id', requireAdmin, async (req, res) => {
    const client = req.supabase || supabase;
    const { modifier_groups, ...itemData } = req.body;
    
    const { data, error } = await client
        .from('menu_items')
        .update(itemData)
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (error) return res.status(404).json({ error: 'Item not found' });
    
    // Sync modifier groups
    if (modifier_groups) {
        await client.from('item_modifier_groups').delete().eq('item_id', req.params.id);
        if (modifier_groups.length > 0) {
            const inserts = modifier_groups.map(groupId => ({
                item_id: req.params.id,
                group_id: groupId,
                display_order: 1
            }));
            await client.from('item_modifier_groups').insert(inserts);
        }
    }
    res.json(data);
});
`;
serverCode = serverCode.replace(/app\.put\('\/api\/admin\/menu\/:id'[\s\S]*?res\.json\(data\);\n}\);/, serverUpdate.trim());
fs.writeFileSync('server.js', serverCode);

// Patch api/admin.js
let apiCode = fs.readFileSync('api/admin.js', 'utf8');
const apiUpdate = `
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
`;
apiCode = apiCode.replace(/if \(action === 'menu_update' && req\.method === 'PATCH'\) {[\s\S]*?return res\.json\(data\);\n    }/, apiUpdate.trim());
fs.writeFileSync('api/admin.js', apiCode);
console.log("Patched server.js and api/admin.js");
