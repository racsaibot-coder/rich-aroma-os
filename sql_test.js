const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.from('orders').select('id, transfer_receipt_url, receipt_url').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
