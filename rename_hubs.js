// rename_hubs.js
require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./api/lib/supabase');

async function rename() {
    console.log("⚡ Renaming Cali Micro-Hubs in database...");

    const updates = [
        { 
            oldName: 'The Ivy Residences (Local Hub)', 
            newName: 'The Ivy Residences' 
        },
        { 
            oldName: "Kaiser Fontana (Sister's Office)", 
            newName: 'Kaiser Fontana' 
        },
        { 
            oldName: "Amazon Hub Eastvale (Sister's Office)", 
            newName: 'Amazon Hub Eastvale' 
        }
    ];

    for (const update of updates) {
        const { data, error } = await supabase
            .from('cali_locations')
            .update({ name: update.newName })
            .eq('name', update.oldName)
            .select();

        if (error) {
            console.error(`❌ Failed to rename '${update.oldName}':`, error.message);
        } else if (data && data.length > 0) {
            console.log(`✅ Renamed '${update.oldName}' to '${update.newName}'`);
        } else {
            console.log(`⚠️ No location found matching '${update.oldName}'`);
        }
    }
}

rename();
