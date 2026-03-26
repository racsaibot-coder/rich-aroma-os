const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
    const { data: items } = await supabase.from('menu_items').select('id, name');
    console.log("Menu Items IDs:");
    items.forEach(i => console.log(i.id, "-", i.name));
}
run();
