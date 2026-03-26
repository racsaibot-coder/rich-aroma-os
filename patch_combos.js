require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Creating Combo Drink modifier group...");
        
        // 1. Create modifier group
        const { data: groupData, error: groupErr } = await supabase
            .from('modifier_groups')
            .upsert([{ id: 'mg_combo_drink', name: 'Bebida de Combo', required: true, max_selections: 1 }])
            .select()
            .single();
            
        if (groupErr) throw new Error("Group error: " + groupErr.message);
        console.log("Group created:", groupData.id);

        // 2. Create options
        const options = [
            { id: 'opt_juice_mango', group_id: 'mg_combo_drink', name: 'Jugo de Mango', price: 0, is_default: true, display_order: 1 },
            { id: 'opt_juice_fresa', group_id: 'mg_combo_drink', name: 'Jugo de Fresa', price: 0, is_default: false, display_order: 2 },
            { id: 'opt_juice_limon', group_id: 'mg_combo_drink', name: 'Jugo de Limón', price: 0, is_default: false, display_order: 3 },
            
            { id: 'opt_granita_mango', group_id: 'mg_combo_drink', name: 'Granita de Mango', price: 30, is_default: false, display_order: 4 },
            { id: 'opt_granita_fresa', group_id: 'mg_combo_drink', name: 'Granita de Fresa', price: 30, is_default: false, display_order: 5 },
            { id: 'opt_granita_limon', group_id: 'mg_combo_drink', name: 'Granita de Limón', price: 30, is_default: false, display_order: 6 },
            
            { id: 'opt_iced_fv', group_id: 'mg_combo_drink', name: 'Iced Coffee French Vanilla', price: 35, is_default: false, display_order: 7 },
            { id: 'opt_iced_caramel', group_id: 'mg_combo_drink', name: 'Iced Coffee Caramel', price: 35, is_default: false, display_order: 8 },
            
            { id: 'opt_frappe_supreme', group_id: 'mg_combo_drink', name: 'Frappe Supreme', price: 45, is_default: false, display_order: 9 },
            { id: 'opt_frappe_fresa', group_id: 'mg_combo_drink', name: 'Frappe Fresa', price: 45, is_default: false, display_order: 10 }
        ];
        
        console.log("Inserting options...");
        const { error: optErr } = await supabase.from('modifier_options').upsert(options);
        if (optErr) throw new Error("Options error: " + optErr.message);
        
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
        const links = targetCombos.map(c => ({
            item_id: c.id,
            group_id: 'mg_combo_drink',
            display_order: 1
        }));
        
        if (links.length > 0) {
            console.log("Linking modifier group to combos...");
            const { error: linkErr } = await supabase.from('item_modifier_groups').upsert(links);
            if (linkErr) throw new Error("Link error: " + linkErr.message);
            console.log("Successfully linked to combos!");
        } else {
            console.log("No combos found to link.");
        }
        
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}
run();
