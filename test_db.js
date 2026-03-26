const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sblmxgkldltslqnjhswj.supabase.co', process.env.SUPABASE_ANON_KEY || 'dummy');
// The API has a schema cache issue. Let's force a schema refresh via RPC if possible or just use the right column
