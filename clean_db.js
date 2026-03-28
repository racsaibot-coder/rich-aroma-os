const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // List customers
    const { data: cust, error: cErr } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (cErr) console.error(cErr);
    else {
        console.log("CUSTOMERS:");
        console.table(cust.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })));
    }
    
    // List orders
    const { data: ord, error: oErr } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(20);
    if (oErr) console.error(oErr);
    else {
        console.log("\nRECENT ORDERS:");
        console.table(ord.map(o => ({ id: o.id, num: o.order_number, total: o.total, status: o.status })));
    }
}
run();
