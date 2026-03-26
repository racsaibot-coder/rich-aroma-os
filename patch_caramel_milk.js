const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Looking for Caramel Iced Coffee...");
        const { data: items } = await supabase.from('menu_items').select('id, name').ilike('name', '%Caramel%Iced%');
        if (!items || items.length === 0) {
            console.log("Could not find Caramel Iced Coffee.");
            return;
        }
        
        const item = items[0];
        console.log("Found:", item.name, item.id);

        console.log("Looking for Milk Type modifier group...");
        const { data: groups } = await supabase.from('modifier_groups').select('id, name').eq('name', 'Milk Type');
        if (!groups || groups.length === 0) {
            console.log("Could not find Milk Type group.");
            return;
        }
        
        const milkGroup = groups[0];
        console.log("Found:", milkGroup.name, milkGroup.id);

        // Check if already linked
        const { data: existingLinks } = await supabase.from('item_modifier_groups').select('*').eq('item_id', item.id).eq('group_id', milkGroup.id);
        
        if (existingLinks && existingLinks.length > 0) {
            console.log("Already linked!");
        } else {
            console.log("Linking...");
            const { error } = await supabase.from('item_modifier_groups').insert({
                item_id: item.id,
                group_id: milkGroup.id,
                display_order: 3 // just an arbitrary order
            });
            if (error) throw error;
            console.log("Successfully linked Milk Type to Caramel Iced Coffee!");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
