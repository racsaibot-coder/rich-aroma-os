const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Find Caramel Iced Coffee
    const { data: items } = await supabase.from('menu_items').select('*').ilike('name', '%Caramel%Iced%');
    console.log('Caramel Iced items:', items.map(i => i.name));
    
    // Also just look for "Iced Coffee" if above fails
    const { data: iced } = await supabase.from('menu_items').select('*').ilike('name', '%Iced%Coffee%');
    console.log('Iced Coffee items:', iced.map(i => i.name));
    
    const targets = [...items, ...iced].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);

    for (const item of targets) {
        // Update base recipe to include 2oz espresso
        const recipe = {
            "16oz": [
                { id: "inv_espresso", name: "Espresso", qty: 2, unit: "oz" },
                { id: "inv_milk_whole", name: "Whole Milk", qty: 8, unit: "oz" },
                { id: "inv_ice", name: "Ice", qty: 1, unit: "cup" },
                { id: "inv_caramel_syrup", name: "Caramel Syrup", qty: 2, unit: "pump" }
            ]
        };
        
        await supabase.from('menu_items').update({ base_recipe: recipe }).eq('id', item.id);
        console.log(`Updated base recipe for ${item.name}`);
        
        // Ensure it has the Espresso modifier option
        const { data: groups } = await supabase.from('modifier_groups').select('*');
        const espressoGroup = groups.find(g => g.name.includes('Espresso Shots') || g.name.includes('Add Espresso'));
        if (espressoGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: item.id,
                group_id: espressoGroup.id,
                display_order: 4
            });
            console.log(`Added Espresso modifier to ${item.name}`);
        }
    }
}
run();