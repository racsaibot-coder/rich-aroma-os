const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Create a specific modifier group for Licuado Flavors
    const { data: licuadoGrp, error: err1 } = await supabase.from('modifier_groups').insert({
        name: 'Licuado Flavors',
        required: true,
        max_selections: 4 // Up to all options
    }).select().single();
    
    if (err1) {
        console.error("Error creating group", err1);
        return;
    }
    
    console.log("Created Group:", licuadoGrp.id);

    // 2. Add the flavors
    const options = [
        { group_id: licuadoGrp.id, name: 'Banana', price_adjustment: 0, is_default: false },
        { group_id: licuadoGrp.id, name: 'Granola', price_adjustment: 0, is_default: false },
        { group_id: licuadoGrp.id, name: 'Avena', price_adjustment: 0, is_default: false },
        { group_id: licuadoGrp.id, name: 'Strawberry', price_adjustment: 0, is_default: false }
    ];
    
    await supabase.from('modifier_options').insert(options);
    console.log("Added flavors to group");
    
    // 3. Find the Licuado item(s) and attach this group
    const { data: licuados } = await supabase.from('menu_items').select('*').ilike('name', '%Licuado%');
    console.log("Found Licuados:", licuados.map(l => l.name));
    
    for (const lic of licuados) {
        await supabase.from('item_modifier_groups').upsert({
            item_id: lic.id,
            group_id: licuadoGrp.id,
            display_order: 1
        });
        console.log(`Attached flavors to ${lic.name}`);
    }
}
run();