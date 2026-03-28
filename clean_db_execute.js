const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Starting safe cleanup of test users...");

    // Find all users with "Test" or "test" in name, or specific fake names like "Cliente"
    const { data: users, error: err } = await supabase
        .from('customers')
        .select('*')
        .or('name.ilike.%test%,name.eq.Cliente,name.eq.meme,name.eq.test');
        
    if (err) {
        console.error("Error fetching users:", err);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No test users found.");
        return;
    }

    console.log(`Found ${users.length} test users to delete.`);

    for (const user of users) {
        console.log(`Deleting user: ${user.name} (${user.id})...`);
        
        // Delete their orders first (foreign key constraints)
        const { error: orderErr } = await supabase
            .from('orders')
            .delete()
            .eq('customer_id', user.id);
            
        if (orderErr) console.error(`Error deleting orders for ${user.id}:`, orderErr.message);

        // Delete the user
        const { error: userErr } = await supabase
            .from('customers')
            .delete()
            .eq('id', user.id);
            
        if (userErr) console.error(`Error deleting user ${user.id}:`, userErr.message);
        else console.log(`Successfully deleted ${user.name}`);
    }

    console.log("Cleanup complete!");
}
run();
