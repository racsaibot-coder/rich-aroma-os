const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Updating Milk Type prices...");

        // Deslactosada
        await supabase.from('modifier_options').update({ price_adjustment: 15 }).ilike('name', 'Deslactosada');
        // Descremada
        await supabase.from('modifier_options').update({ price_adjustment: 15 }).ilike('name', 'Descremada');
        // Almond
        await supabase.from('modifier_options').update({ price_adjustment: 15 }).ilike('name', 'Almond');
        // Oat
        await supabase.from('modifier_options').update({ price_adjustment: 15 }).ilike('name', 'Oat');

        console.log("Done!");
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}
run();