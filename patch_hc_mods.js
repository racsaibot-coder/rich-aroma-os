const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    console.log('Groups:', groups);
    
    const { data: hc } = await supabase.from('menu_items').select('*').ilike('name', '%Chocolate%');
    console.log('Hot Chocolate:', hc);
    
    // Assign milk and syrup to Hot Chocolate (skip espresso)
    if (hc.length > 0) {
        const hcId = hc[0].id;
        
        const milkGroup = groups.find(g => g.name.includes('Milk') || g.name.includes('Leche'));
        const syrupGroup = groups.find(g => g.name.includes('Syrup') || g.name.includes('Jarabe'));
        
        if (milkGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: hcId,
                group_id: milkGroup.id,
                display_order: 1
            });
            console.log('Added Milk to Hot Chocolate');
        }
        
        if (syrupGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: hcId,
                group_id: syrupGroup.id,
                display_order: 2
            });
            console.log('Added Syrup to Hot Chocolate');
        }
    }
}
run();