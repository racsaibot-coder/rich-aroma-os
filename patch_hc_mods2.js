const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    
    // Find Hot Chocolate by exact name or ID if possible. Let's filter post query
    const { data: items } = await supabase.from('menu_items').select('*');
    const hc = items.find(i => i.name === 'Hot Chocolate');
    
    console.log('Found Hot Chocolate:', hc ? hc.id : 'Not found');
    
    if (hc) {
        const hcId = hc.id;
        
        const milkGroup = groups.find(g => g.name === 'Milk Type');
        const syrupGroup = groups.find(g => g.name === 'Flavor' && g.created_at.includes('18:57:55.801')); // one of them
        const sizeGroup = groups.find(g => g.name.includes('Size (Cappuccino/Latte)'));
        
        if (sizeGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: hcId,
                group_id: sizeGroup.id,
                display_order: 1
            });
            console.log('Added Size to Hot Chocolate');
        }

        if (milkGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: hcId,
                group_id: milkGroup.id,
                display_order: 2
            });
            console.log('Added Milk to Hot Chocolate');
        }
        
        if (syrupGroup) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: hcId,
                group_id: syrupGroup.id,
                display_order: 3
            });
            console.log('Added Syrup to Hot Chocolate');
        }
    }
}
run();