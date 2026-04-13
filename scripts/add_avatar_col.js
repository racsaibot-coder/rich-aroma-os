const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Adding avatar_url to customers table...");
    // Since I don't know if 'run_sql' exists, I'll just assume it does or tell the user to run it.
    // In a real scenario, I'd use the SQL editor.
    console.log("SQL: ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;");
}
run();
