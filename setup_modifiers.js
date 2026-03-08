// create_modifiers_tables.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    console.log("Setting up dynamic modifier tables...");

    // 1. We need to create the modifier_groups table
    // NOTE: For safety, instead of running DDL raw (which requires service_role key),
    // I'll try to just insert into existing `menu_modifiers` if it exists and has the right schema.
    // Wait, the API `api/store.js` already selects from `menu_modifiers`. Let's check its schema.

    const { data: cols, error: colErr } = await supabase.from('menu_modifiers').select('*').limit(1);
    
    if (colErr) {
        console.error("Error accessing menu_modifiers:", colErr);
        // It likely doesn't exist or isn't set up the way we want.
        console.log("Please run this SQL in your Supabase SQL Editor:");
        console.log(`
CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    required BOOLEAN DEFAULT false,
    max_selections INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.modifier_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.item_modifier_groups (
    item_id TEXT REFERENCES public.menu_items(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (item_id, group_id)
);
        `);
        return;
    } else {
        console.log("menu_modifiers exists. Let's see what's in it:", cols);
    }
}

setupDatabase();
