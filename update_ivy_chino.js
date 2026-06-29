// update_ivy_chino.js
require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./api/lib/supabase');

async function updateCity() {
    console.log("⚡ Updating The Ivy Residences city to Chino...");

    try {
        const { data, error } = await supabase
            .from('cali_locations')
            .update({ city: 'Chino' })
            .eq('name', 'The Ivy Residences (Local Hub)')
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            console.log("✅ Successfully updated location:");
            console.table(data.map(l => ({ id: l.id, name: l.name, city: l.city, distributor_name: l.distributor_name })));
        } else {
            console.log("⚠️ No location found matching 'The Ivy Residences (Local Hub)'");
        }
    } catch (e) {
        console.error("❌ Update failed:", e.message);
    }
}

updateCity();
