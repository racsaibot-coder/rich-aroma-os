const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('modifier_groups')
        .update({ max_selections: 1 })
        .eq('name', 'Ingredientes Base');

    if (error) {
        console.error("Error updating:", error);
    } else {
        console.log("Success! Updated max_selections to 1 for Ingredientes Base");
    }
}
run();
