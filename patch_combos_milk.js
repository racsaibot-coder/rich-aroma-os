const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Setting up N/A for Milk Type and linking Combos...");

        // 1. Find Milk Type Group
        const { data: milkGroups } = await supabase.from('modifier_groups').select('id').eq('name', 'Milk Type');
        if (!milkGroups || milkGroups.length === 0) throw new Error("Milk Type group not found");
        const milkGroupId = milkGroups[0].id;

        // 2. Add N/A to Milk Type if it doesn't exist
        const { data: naOptions } = await supabase.from('modifier_options').select('id').eq('group_id', milkGroupId).eq('name', 'N/A');
        let naOptId;
        if (naOptions && naOptions.length > 0) {
            naOptId = naOptions[0].id;
        } else {
            const { data, error } = await supabase.from('modifier_options').insert([{
                group_id: milkGroupId,
                name: 'N/A',
                price_adjustment: 0,
                is_default: false
            }]).select().single();
            if (error) throw new Error("Failed to insert N/A option: " + error.message);
            naOptId = data.id;
        }

        // Get Regular milk ID for Iced Coffees
        const { data: regOptions } = await supabase.from('modifier_options').select('id').eq('group_id', milkGroupId).eq('name', 'Regular');
        const regOptId = regOptions[0].id;

        // 3. Find Combos
        const { data: combos } = await supabase.from('menu_items').select('id, name, base_recipe').ilike('name', 'Combo%');
        const targetCombos = combos.filter(c => c.name.match(/Combo [1234]\b/i));

        // 4. Link Milk Type to Combos
        const { data: existingLinks } = await supabase.from('item_modifier_groups').select('*').eq('group_id', milkGroupId);
        const newLinks = targetCombos
            .filter(c => !existingLinks.some(l => l.item_id === c.id))
            .map(c => ({
                item_id: c.id,
                group_id: milkGroupId,
                display_order: 2
            }));
            
        if (newLinks.length > 0) {
            await supabase.from('item_modifier_groups').insert(newLinks);
            console.log("Linked Milk Type to combos");
        }

        // 5. Update base_recipe for Combos
        for (const combo of targetCombos) {
            let recipe = combo.base_recipe || {};
            
            // Map Juice to N/A
            const juices = ['Jugo de Mango', 'Jugo de Fresa', 'Jugo de Limón', 'Granita de Mango', 'Granita de Fresa', 'Granita de Limón'];
            juices.forEach(j => {
                if (!recipe[j]) recipe[j] = {};
                recipe[j][milkGroupId] = naOptId;
            });

            // Map Iced/Frappe to Regular Milk
            const milkDrinks = ['Iced Coffee French Vanilla', 'Iced Coffee Caramel', 'Frappe Supreme', 'Frappe Fresa'];
            milkDrinks.forEach(d => {
                if (!recipe[d]) recipe[d] = {};
                recipe[d][milkGroupId] = regOptId;
            });

            await supabase.from('menu_items').update({ base_recipe: recipe }).eq('id', combo.id);
            console.log(`Updated base_recipe for ${combo.name}`);
        }

        console.log("Done!");
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}
run();