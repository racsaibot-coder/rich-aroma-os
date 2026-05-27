const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const emp = {
        id: 'test_emp_' + Date.now(),
        name: "Test Employee Direct",
        role: "barista",
        pin: "8888",
        pay_type: "hourly",
        hourly_rate: 50,
        active: true,
        restaurant_id: 'rich-aroma'
    };

    console.log("Attempting direct Supabase insert...");
    const { data, error } = await supabase.from('employees').insert(emp).select().single();

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("SUCCESS:", data);
        // Clean up
        await supabase.from('employees').delete().eq('id', emp.id);
        console.log("Cleaned up test employee.");
    }
}

test();
