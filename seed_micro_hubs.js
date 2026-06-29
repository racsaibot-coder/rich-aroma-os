// seed_micro_hubs.js
require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./api/lib/supabase');

const MICRO_HUBS = [
    { name: 'The Ivy Residences (Local Hub)', city: 'Ontario', distributor_name: 'Micro-Hub', active: true },
    { name: 'Kaiser Fontana (Sister\'s Office)', city: 'Fontana', distributor_name: 'Micro-Hub', active: true },
    { name: 'Amazon Hub Eastvale (Sister\'s Office)', city: 'Eastvale', distributor_name: 'Micro-Hub', active: true }
];

async function seed() {
    console.log("🌱 Seeding California Micro-Hub Locations...");

    try {
        // Fetch existing locations
        const { data: existing, error: fetchErr } = await supabase
            .from('cali_locations')
            .select('name');
        
        if (fetchErr) throw fetchErr;
        const existingNames = new Set((existing || []).map(l => l.name));

        const toInsert = MICRO_HUBS.filter(l => !existingNames.has(l.name));

        if (toInsert.length === 0) {
            console.log("✅ All micro-hubs already seeded! No new inserts required.");
            return;
        }

        console.log(`Inserting ${toInsert.length} new micro-hubs...`);
        const { data: inserted, error: insertErr } = await supabase
            .from('cali_locations')
            .insert(toInsert)
            .select();

        if (insertErr) throw insertErr;

        console.log(`✅ Successfully seeded ${inserted.length} micro-hubs!`);
        console.table(inserted.map(l => ({ id: l.id, name: l.name, city: l.city, distributor_name: l.distributor_name })));

    } catch (err) {
        console.error("❌ Seeding failed:", err.message);
    }
}

seed();
