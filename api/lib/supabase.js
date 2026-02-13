// api/lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

// These will be loaded from Vercel Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
