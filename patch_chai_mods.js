const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const assignments = [
        {
            itemId: 'hot_chai_latte',
            groups: [
                { group_id: 'b919f7ac-41ea-4122-a653-e975041764f9', display_order: 1 }, // Size (Chai/Matcha)
                { group_id: '0d5d6d40-58aa-4fc7-8846-c3f4b3876636', display_order: 2 }, // Milk Type
                { group_id: '51102503-24e1-4fd9-b8a2-b335b9255595', display_order: 3 }  // Add Espresso
            ]
        },
        {
            itemId: 'frappe_chai',
            groups: [
                { group_id: '0d5d6d40-58aa-4fc7-8846-c3f4b3876636', display_order: 1 }, // Milk Type
                { group_id: '6efc6122-0902-4305-8deb-f7aa8d2e973e', display_order: 2 }, // Frappe Add-ons
                { group_id: '51102503-24e1-4fd9-b8a2-b335b9255595', display_order: 3 }  // Add Espresso
            ]
        }
    ];

    for (const entry of assignments) {
        console.log(`Assigning modifier groups to ${entry.itemId}...`);
        for (const g of entry.groups) {
            const { error } = await supabase
                .from('item_modifier_groups')
                .upsert({ 
                    item_id: entry.itemId, 
                    group_id: g.group_id,
                    display_order: g.display_order 
                }, { onConflict: 'item_id,group_id' });
            
            if (error) {
                console.error(`Error assigning group ${g.group_id} to ${entry.itemId}:`, error.message);
            } else {
                console.log(`Assigned group ${g.group_id} to ${entry.itemId} successfully.`);
            }
        }
    }
}

run();
