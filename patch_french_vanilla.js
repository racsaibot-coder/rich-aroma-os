const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Find French Vanilla
    const { data: items, error: fetchErr } = await supabase.from('menu_items')
        .select('*')
        .ilike('name', '%French%Vanilla%');
        
    if (fetchErr) {
        console.error("Error finding item:", fetchErr);
        return;
    }
    
    console.log('Found items:', items.map(i => `${i.name} (Current Price: ${i.price})`));
    
    // 2. Update Price
    for (const item of items) {
        const { error: updateErr } = await supabase.from('menu_items')
            .update({ price: 85 })
            .eq('id', item.id);
            
        if (updateErr) {
            console.error(`Error updating ${item.name}:`, updateErr);
        } else {
            console.log(`Updated ${item.name} to 85 Lps`);
        }
    }
}
run();