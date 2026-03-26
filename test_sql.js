const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://zcqubacfcettwawcimsy.supabase.co', 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq'); 
async function run() {
    console.log("Fetching menu items with base_recipe...");
    const { data, error } = await supabase.from('menu_items').select('id, name, base_recipe').limit(2);
    if(error) {
        console.log("Error finding column, creating it via REST fallback or error message:");
        console.log(error);
    } else {
        console.log("Data exists:", data);
    }
}
run();
