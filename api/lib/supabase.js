// api/lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

// These will be loaded from Vercel Environment Variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
