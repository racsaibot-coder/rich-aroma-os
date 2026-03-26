const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: products, error } = await supabase.from('cali_products').select('*');
    if(error) { console.error(error); return; }

    const activeProducts = products.filter(p => p.active);
    const inactiveProducts = products.filter(p => !p.active);
    
    // Delete inactive
    for (const p of inactiveProducts) {
        await supabase.from('cali_products').delete().eq('id', p.id);
        console.log('Deleted inactive:', p.name);
    }
    
    // Find duplicates (by name)
    const seen = new Set();
    for (const p of activeProducts) {
        if (seen.has(p.name)) {
            await supabase.from('cali_products').delete().eq('id', p.id);
            console.log('Deleted duplicate:', p.name);
        } else {
            seen.add(p.name);
        }
    }
    console.log('Cleanup done.');
}
run();