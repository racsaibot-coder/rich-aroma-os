const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { error } = await supabase.from('orders').update({ receipt_url: 'test', status: 'pending_verification' }).eq('id', 'TEST_ORDER_123');
  console.log(error);
}
run();
