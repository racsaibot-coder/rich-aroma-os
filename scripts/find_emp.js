const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        const { data, error } = await supabase.from('employees').select('*').eq('active', true).limit(1);
        if (error) console.error(error);
        else console.log(JSON.stringify(data));
    } catch(e) { console.error(e); }
}
test();
