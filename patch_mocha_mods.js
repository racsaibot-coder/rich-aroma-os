const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: items } = await supabase.from('menu_items').select('id, name');
    const lattes = items.filter(i => i.name.toLowerCase().includes('latte'));
    const mochas = items.filter(i => i.name.toLowerCase().includes('mocha'));
    console.log('Lattes:', lattes);
    console.log('Mochas:', mochas);
    
    if (lattes.length > 0) {
        const latteId = lattes[0].id;
        const { data: mods } = await supabase.from('item_modifier_groups').select('*').eq('item_id', latteId);
        console.log('Latte modifiers:', mods);
        
        // Copy to Mochas
        for (const mocha of mochas) {
            for (const mod of mods) {
                await supabase.from('item_modifier_groups').upsert({
                    item_id: mocha.id,
                    group_id: mod.group_id,
                    display_order: mod.display_order
                });
            }
            console.log(`Copied mods to ${mocha.name}`);
            
            // Check base recipe or modifiers for default espresso
            const { data: recipe } = await supabase.from('base_recipes').select('*').eq('item_id', mocha.id);
            console.log(`Mocha ${mocha.name} recipe:`, recipe);
        }
    }
}
run();