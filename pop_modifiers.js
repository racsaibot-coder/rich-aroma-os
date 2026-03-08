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

async function populateModifiers() {
    console.log("Populating initial modifiers...");

    // 1. Create Milk Group
    const { data: milkGrp } = await supabase.from('modifier_groups').insert({
        name: 'Milk / Leche',
        required: true,
        max_selections: 1
    }).select().single();

    // Add Milk Options
    await supabase.from('modifier_options').insert([
        { group_id: milkGrp.id, name: 'Whole (Std)', price_adjustment: 0, is_default: true },
        { group_id: milkGrp.id, name: 'Oat', price_adjustment: 15, is_default: false },
        { group_id: milkGrp.id, name: 'Almond', price_adjustment: 15, is_default: false },
        { group_id: milkGrp.id, name: 'Soy', price_adjustment: 15, is_default: false }
    ]);

    // 2. Create Syrup Group
    const { data: syrupGrp } = await supabase.from('modifier_groups').insert({
        name: 'Flavor / Sabor',
        required: false,
        max_selections: 1
    }).select().single();

    // Add Syrup Options
    await supabase.from('modifier_options').insert([
        { group_id: syrupGrp.id, name: 'None', price_adjustment: 0, is_default: true },
        { group_id: syrupGrp.id, name: 'Vanilla', price_adjustment: 10, is_default: false },
        { group_id: syrupGrp.id, name: 'Caramel', price_adjustment: 10, is_default: false },
        { group_id: syrupGrp.id, name: 'Hazelnut', price_adjustment: 10, is_default: false }
    ]);

    // 3. Create Shots Group
    const { data: shotsGrp } = await supabase.from('modifier_groups').insert({
        name: 'Extra Espresso Shots',
        required: false,
        max_selections: 4
    }).select().single();

    await supabase.from('modifier_options').insert([
        { group_id: shotsGrp.id, name: '+1 Shot', price_adjustment: 10, is_default: false },
        { group_id: shotsGrp.id, name: '+2 Shots', price_adjustment: 20, is_default: false }
    ]);

    console.log("Modifier groups and options created.");

    // Link them to all coffee items
    const { data: items } = await supabase.from('menu_items').select('id, category');
    
    for (const item of items) {
        if (item.category === 'coffee' || item.category === 'drinks') {
            await supabase.from('item_modifier_groups').insert([
                { item_id: item.id, group_id: milkGrp.id, display_order: 1 },
                { item_id: item.id, group_id: syrupGrp.id, display_order: 2 },
                { item_id: item.id, group_id: shotsGrp.id, display_order: 3 }
            ]);
        }
    }
    
    console.log("Modifiers linked to items!");
}

populateModifiers();
