
const { createClient } = require('@supabase/supabase-js');

// Config from server.js
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("🔍 Checking 'founders' table...");
    try {
        const { data, error, count } = await supabase.from('founders').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("❌ Error accessing 'founders':", error);
            if (error.code === '42P01') {
                console.log("💡 Hint: Table might be missing.");
            }
        } else {
            console.log("✅ Table 'founders' exists. Count:", count);
        }
    } catch (e) {
        console.error("❌ Exception:", e);
    }
}

check();
