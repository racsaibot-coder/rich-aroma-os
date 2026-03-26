const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.from('orders').update({ receipt_url: 'test_url' }).eq('id', '123');
  console.log("Error:", error);
}
run();
