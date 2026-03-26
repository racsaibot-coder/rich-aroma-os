const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Espresso Shots Group ID: '5db96be4-aaf3-41db-ab21-4d5b555e00f0'
    // 1 Shot Option ID: '09bd08c4-8194-4e41-b551-1785c8d2f3f8'
    // 2 Shots Option ID: 'a93cf7b4-a6e4-4f4e-ab55-8fbc8e7478d1'

    const espressoShotsGroupId = '5db96be4-aaf3-41db-ab21-4d5b555e00f0';
    const shot1Id = '09bd08c4-8194-4e41-b551-1785c8d2f3f8';
    const shot2Id = 'a93cf7b4-a6e4-4f4e-ab55-8fbc8e7478d1';

    const baseRecipe = {
        "8oz": { [espressoShotsGroupId]: shot1Id },
        "12oz": { [espressoShotsGroupId]: shot2Id }
    };

    const itemsToUpdate = [
        'hot_cappuccino',
        'hot_latte',
        'hot_americano',
        'hot_mocha'
    ];

    for (const itemId of itemsToUpdate) {
        const { error } = await supabase
            .from('menu_items')
            .update({ base_recipe: baseRecipe })
            .eq('id', itemId);
        
        if (error) {
            console.error(`Error updating ${itemId}:`, error);
        } else {
            console.log(`Successfully updated base_recipe for ${itemId}`);
        }
    }
}
run();
