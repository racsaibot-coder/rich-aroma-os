const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: itemMods, error } = await supabase.from('item_modifier_groups').select('item_id, group_id');
    
    const espressoShotsGroupId = '5db96be4-aaf3-41db-ab21-4d5b555e00f0';
    
    if (itemMods) {
        const drinksWithShots = itemMods.filter(i => i.group_id === espressoShotsGroupId).map(i => i.item_id);
        console.log('Drinks with espresso shots group:', [...new Set(drinksWithShots)]);
    }
}
run();