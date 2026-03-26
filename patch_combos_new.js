const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Checking if Combo Drink modifier group exists...");
        let { data: existingGroups, error: groupFetchErr } = await supabase
            .from('modifier_groups')
            .select('*')
            .eq('name', 'Bebida de Combo');
        
        if (groupFetchErr) throw new Error("Fetch group error: " + groupFetchErr.message);

        let groupData;

        if (existingGroups && existingGroups.length > 0) {
            groupData = existingGroups[0];
            console.log("Group already exists:", groupData.id);
        } else {
            console.log("Creating Combo Drink modifier group...");
            // 1. Create modifier group
            const { data, error: groupErr } = await supabase
                .from('modifier_groups')
                .insert([{ name: 'Bebida de Combo', required: true, max_selections: 1 }])
                .select()
                .single();
                
            if (groupErr) throw new Error("Group error: " + groupErr.message);
            groupData = data;
            console.log("Group created:", groupData.id);
        }

        // 2. Create options
        const groupId = groupData.id;

        // Check if options already exist
        const { data: existingOptions } = await supabase.from('modifier_options').select('*').eq('group_id', groupId);

        if (existingOptions && existingOptions.length === 0) {
            const options = [
                { group_id: groupId, name: 'Jugo de Mango', price_adjustment: 0, is_default: true },
                { group_id: groupId, name: 'Jugo de Fresa', price_adjustment: 0, is_default: false },
                { group_id: groupId, name: 'Jugo de Limón', price_adjustment: 0, is_default: false },
                
                { group_id: groupId, name: 'Granita de Mango', price_adjustment: 30, is_default: false },
                { group_id: groupId, name: 'Granita de Fresa', price_adjustment: 30, is_default: false },
                { group_id: groupId, name: 'Granita de Limón', price_adjustment: 30, is_default: false },
                
                { group_id: groupId, name: 'Iced Coffee French Vanilla', price_adjustment: 35, is_default: false },
                { group_id: groupId, name: 'Iced Coffee Caramel', price_adjustment: 35, is_default: false },
                
                { group_id: groupId, name: 'Frappe Supreme', price_adjustment: 45, is_default: false },
                { group_id: groupId, name: 'Frappe Fresa', price_adjustment: 45, is_default: false }
            ];
            
            console.log("Inserting options...");
            const { error: optErr } = await supabase.from('modifier_options').insert(options);
            if (optErr) throw new Error("Options error: " + optErr.message);
        } else {
            console.log("Options already exist.");
        }
        
        // 3. Find Combos 1, 2, 3, 4
        console.log("Finding combos...");
        const { data: combos, error: comboErr } = await supabase
            .from('menu_items')
            .select('id, name')
            .ilike('name', 'Combo%');
            
        if (comboErr) throw new Error("Combo error: " + comboErr.message);
        
        const targetCombos = combos.filter(c => c.name.match(/Combo [1234]\b/i));
        console.log("Target combos found:", targetCombos.map(c => c.name).join(', '));
        
        // 4. Link them
        const { data: existingLinks } = await supabase.from('item_modifier_groups').select('*').eq('group_id', groupId);

        const newLinks = targetCombos
            .filter(c => !existingLinks.some(l => l.item_id === c.id))
            .map(c => ({
                item_id: c.id,
                group_id: groupId,
                display_order: 1
            }));
        
        if (newLinks.length > 0) {
            console.log(`Linking modifier group to ${newLinks.length} combos...`);
            const { error: linkErr } = await supabase.from('item_modifier_groups').insert(newLinks);
            if (linkErr) throw new Error("Link error: " + linkErr.message);
            console.log("Successfully linked to combos!");
        } else {
            console.log("No new combos to link (already linked).");
        }
        
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}
run();