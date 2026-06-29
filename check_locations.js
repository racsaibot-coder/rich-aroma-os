// check_locations.js
require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./api/lib/supabase');

async function check() {
    const { data, error } = await supabase
        .from('cali_locations')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    console.table(data.map(l => ({ id: l.id, name: l.name, city: l.city, distributor_name: l.distributor_name })));
}

check();
