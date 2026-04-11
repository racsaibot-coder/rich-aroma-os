const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://zcqubacfcettwawcimsy.supabase.co', 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq');

async function check() {
    const { data, error } = await supabase.from('customers').select('*').limit(1);
    if(error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
}
check();
