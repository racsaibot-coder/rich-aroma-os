const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Removing decaf options...");
        const { error } = await supabase.from('modifier_options').delete().ilike('name', '%decaf%');
        if (error) throw error;
        console.log("Successfully removed decaf options from all modifier groups.");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
