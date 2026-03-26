const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('menu_items').select('id, name, category, active');
  if (error) console.error(error);
  else {
      console.log(data.filter(d => d.name.toLowerCase().includes('combo') || (d.category && d.category.toLowerCase().includes('combo'))).map(d => ({name: d.name, cat: d.category})));
  }
}
run();
