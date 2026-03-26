const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://zcqubacfcettwawcimsy.supabase.co', 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq');

async function run() {
    const { data: groups } = await supabase.from('modifier_groups').select('id, name');
    const sizeGroups = groups.filter(g => g.name.startsWith('Size'));

    for (const group of sizeGroups) {
        console.log(`Processing group: ${group.name}`);
        
        const { data: options } = await supabase.from('modifier_options').select('*').eq('group_id', group.id);
        const oz8 = options.find(o => o.name === '8oz');
        const oz12 = options.find(o => o.name === '12oz');

        if (!oz8 || !oz12) {
            console.log(`Missing size options in ${group.name}, skipping.`);
            continue;
        }

        // If 12oz is already the default, skip to avoid double incrementing prices
        if (oz12.is_default) {
            console.log(`12oz is already default for ${group.name}, skipping.`);
            continue;
        }

        const upcharge = oz12.price_adjustment;
        
        // 12 oz becomes default (0 adjustment)
        await supabase.from('modifier_options').update({ 
            price_adjustment: 0, 
            is_default: true 
        }).eq('id', oz12.id);

        // 8 oz becomes non-default (-upcharge adjustment)
        await supabase.from('modifier_options').update({ 
            price_adjustment: -upcharge, 
            is_default: false 
        }).eq('id', oz8.id);

        console.log(`Updated modifier options for ${group.name}: 12oz (+0), 8oz (-${upcharge})`);

        // Find items linked to this group to update base price
        const { data: links } = await supabase.from('item_modifier_groups').select('item_id').eq('group_id', group.id);
        const itemIds = links.map(l => l.item_id);

        if (itemIds.length > 0) {
            const { data: items } = await supabase.from('menu_items').select('id, name, price').in('id', itemIds);
            
            for (const item of items) {
                const newPrice = item.price + upcharge;
                await supabase.from('menu_items').update({ price: newPrice }).eq('id', item.id);
                console.log(`Updated base price for ${item.name}: ${item.price} -> ${newPrice}`);
            }
        }
    }
    console.log("All done!");
}
run();