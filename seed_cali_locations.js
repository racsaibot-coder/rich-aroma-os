// seed_cali_locations.js
require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./api/lib/supabase');

const HUB_LOCATIONS = [
    { name: 'Kaiser Ontario', city: 'Ontario', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Fontana', city: 'Fontana', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Baldwin Park', city: 'Baldwin Park', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Riverside', city: 'Riverside', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Moreno Valley', city: 'Moreno Valley', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Irvine (Sand Canyon)', city: 'Irvine', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Anaheim (Kraemer)', city: 'Anaheim', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Downey', city: 'Downey', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Panorama City', city: 'Panorama City', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser Los Angeles / Sunset', city: 'Los Angeles', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser West LA', city: 'Los Angeles', distributor_name: 'Kaiser', active: true },
    { name: 'Kaiser South Bay / Harbor', city: 'Harbor City', distributor_name: 'Kaiser', active: true },
    { name: 'Amazon ONT2', city: 'San Bernardino', distributor_name: 'Amazon', active: true },
    { name: 'Amazon ONT6', city: 'Moreno Valley', distributor_name: 'Amazon', active: true },
    { name: 'Amazon SNA4', city: 'Rialto', distributor_name: 'Amazon', active: true },
    { name: 'Amazon LGB8', city: 'Rialto', distributor_name: 'Amazon', active: true },
    { name: 'Amazon ONT9', city: 'Redlands', distributor_name: 'Amazon', active: true }
];

async function seed() {
    console.log("🌱 Seeding California Hub Locations...");

    try {
        // Fetch existing locations
        const { data: existing, error: fetchErr } = await supabase
            .from('cali_locations')
            .select('name');
        
        if (fetchErr) throw fetchErr;
        const existingNames = new Set((existing || []).map(l => l.name));

        const toInsert = HUB_LOCATIONS.filter(l => !existingNames.has(l.name));

        if (toInsert.length === 0) {
            console.log("✅ All locations already seeded! No new inserts required.");
            return;
        }

        console.log(`Inserting ${toInsert.length} new locations...`);
        const { data: inserted, error: insertErr } = await supabase
            .from('cali_locations')
            .insert(toInsert)
            .select();

        if (insertErr) throw insertErr;

        console.log(`✅ Successfully seeded ${inserted.length} locations!`);
        console.table(inserted.map(l => ({ id: l.id, name: l.name, city: l.city })));

    } catch (err) {
        console.error("❌ Seeding failed:", err.message);
    }
}

seed();
