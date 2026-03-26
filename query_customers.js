const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .gte('created_at', yesterday);
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${customers.length} new customers in the last 24 hours.`);
        customers.forEach(c => console.log(`- ${c.name} (${c.phone})`));
    }
}
run();
