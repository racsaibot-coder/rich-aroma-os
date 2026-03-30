const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateReport() {
    console.log("💰 RICO CASH LIABILITY REPORT 💰\n");
    console.log("Fetching data from database...\n");

    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, name, phone, rico_balance');

        if (error) throw error;

        let totalCash = 0;
        let activeAccounts = 0;
        
        const holders = [];

        customers.forEach(c => {
            const cash = parseFloat(c.rico_balance) || 0;
            const total = cash;
            
            totalCash += cash;
            
            if (total > 0) {
                activeAccounts++;
                holders.push({ name: c.name || 'Unknown', phone: c.phone, total });
            }
        });

        holders.sort((a, b) => b.total - a.total);

        console.log("-------------------------------------------------");
        console.log(`TOTAL OUTSTANDING LIABILITY: L. ${totalCash.toFixed(2)}`);
        console.log(`Active Rico Cash Accounts: ${activeAccounts}`);
        console.log("-------------------------------------------------\n");

        console.log("🏆 TOP 10 RICO CASH HOLDERS:");
        holders.slice(0, 10).forEach((h, i) => {
            console.log(`${i + 1}. ${h.name} (${h.phone}): L. ${h.total.toFixed(2)}`);
        });

        console.log("\n✅ Report generated successfully.");
        
    } catch (e) {
        console.error("Error generating report:", e.message);
    }
}

generateReport();
