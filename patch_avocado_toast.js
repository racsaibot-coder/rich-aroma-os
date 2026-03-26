const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Create Modifier Groups for Avocado Toast
    
    // Group 1: Style of Egg
    const { data: eggGrp, error: err1 } = await supabase.from('modifier_groups').insert({
        name: 'Style of Egg',
        required: true,
        max_selections: 1
    }).select().single();
    
    if (err1) {
        console.error("Error creating egg group", err1);
        return;
    }
    
    await supabase.from('modifier_options').insert([
        { group_id: eggGrp.id, name: 'Scrambled (Revuelta)', price_adjustment: 0, is_default: true },
        { group_id: eggGrp.id, name: 'Over Easy (Estrellado)', price_adjustment: 0, is_default: false },
        { group_id: eggGrp.id, name: 'No Egg', price_adjustment: 0, is_default: false }
    ]);

    // Group 2: Red Pepper Flakes
    const { data: flakeGrp, error: err2 } = await supabase.from('modifier_groups').insert({
        name: 'Red Pepper Flakes',
        required: true,
        max_selections: 1
    }).select().single();

    if (err2) {
        console.error("Error creating flake group", err2);
        return;
    }

    await supabase.from('modifier_options').insert([
        { group_id: flakeGrp.id, name: 'Yes (Con Chile)', price_adjustment: 0, is_default: true },
        { group_id: flakeGrp.id, name: 'No (Sin Chile)', price_adjustment: 0, is_default: false }
    ]);

    // 2. Attach to Avocado Toast
    const { data: toasts } = await supabase.from('menu_items').select('*').ilike('name', '%Avocado%Toast%');
    console.log("Found Avocado Toasts:", toasts.map(b => b.name));

    for (const toast of toasts) {
        await supabase.from('item_modifier_groups').upsert([
            { item_id: toast.id, group_id: eggGrp.id, display_order: 1 },
            { item_id: toast.id, group_id: flakeGrp.id, display_order: 2 }
        ]);
        console.log(`Attached mods to ${toast.name}`);
    }
}
run();