const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Get the Tamaño group
    const { data: sizeGroup } = await supabase.from('modifier_groups').select('*').eq('name', 'Tamaño').single();
    if (!sizeGroup) {
        console.error("Tamaño group not found");
        return;
    }

    // 2. Get options
    const { data: options } = await supabase.from('modifier_options').select('*').eq('group_id', sizeGroup.id);
    const oz8 = options.find(o => o.name === '8 oz');
    const oz12 = options.find(o => o.name === '12 oz');

    if (!oz8 || !oz12) {
        console.error("Missing size options");
        return;
    }

    // 3. Update options
    // 12 oz becomes default (0 adjustment)
    await supabase.from('modifier_options').update({ 
        price_adjustment: 0, 
        is_default: true 
    }).eq('id', oz12.id);

    // 8 oz becomes non-default (-15 adjustment)
    await supabase.from('modifier_options').update({ 
        price_adjustment: -15, 
        is_default: false 
    }).eq('id', oz8.id);

    console.log("Updated modifier options.");

    // 4. Update base prices for all drinks linked to this group
    // First, find which items have this group
    const { data: links } = await supabase.from('item_modifier_groups').select('item_id').eq('group_id', sizeGroup.id);
    const itemIds = links.map(l => l.item_id);

    if (itemIds.length > 0) {
        // Fetch current prices
        const { data: items } = await supabase.from('menu_items').select('id, name, price').in('id', itemIds);
        
        for (const item of items) {
            // Increase base price by 15 (since 12oz was previously +15)
            // But only if we haven't already updated it (how to know? 
            // We assume it's currently at the 8oz price. If a basic coffee is ~50, it becomes 65)
            const newPrice = item.price + 15;
            await supabase.from('menu_items').update({ price: newPrice }).eq('id', item.id);
            console.log(`Updated ${item.name}: ${item.price} -> ${newPrice}`);
        }
    }

    console.log("Done!");
}
run();