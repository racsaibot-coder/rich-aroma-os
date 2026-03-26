const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    let { data: sizeGroup } = await supabase.from('modifier_groups').select('*').eq('name', 'Tamaño').single();

    if (!sizeGroup) {
        console.log("Creating 'Tamaño' group...");
        const res = await supabase.from('modifier_groups').insert({ name: 'Tamaño', max_selections: 1, required: true }).select().single();
        sizeGroup = res.data;
        await supabase.from('modifier_options').insert([
            { group_id: sizeGroup.id, name: '8 oz', price_adjustment: 0, is_default: true },
            { group_id: sizeGroup.id, name: '12 oz', price_adjustment: 15, is_default: false }
        ]);
    }

    const { data: hotDrinks } = await supabase.from('menu_items').select('id, name').eq('category', 'coffee');
    console.log("Found " + hotDrinks.length + " hot drinks.");

    const links = hotDrinks.map(drink => ({
        item_id: drink.id,
        group_id: sizeGroup.id,
        display_order: 1
    }));

    const { error } = await supabase.from('item_modifier_groups').upsert(links, { onConflict: 'item_id,group_id' });
    if (error) console.error("Error linking:", error);
    else console.log("Successfully linked 'Tamaño' to all hot drinks!");
}
run();
