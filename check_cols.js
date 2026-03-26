const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('menu_items').select('*').limit(1);
    if (data) console.log(Object.keys(data[0]));
    if (error) console.log(error);
}
run();
