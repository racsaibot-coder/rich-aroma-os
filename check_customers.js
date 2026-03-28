const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    const { data: cust, error: cErr } = await supabase.from('customers').select('id, name, phone, email, created_at').order('created_at', { ascending: false }).limit(20);
    if (cErr) console.error(cErr);
    else {
        console.log("CUSTOMERS:");
        console.table(cust);
    }
    
    const { data: ord, error: oErr } = await supabase.from('orders').select('id, order_number, customer_id, total, status, payment_method').order('created_at', { ascending: false }).limit(20);
    if (oErr) console.error(oErr);
    else {
        console.log("\nRECENT ORDERS:");
        console.table(ord);
    }
}
run();
