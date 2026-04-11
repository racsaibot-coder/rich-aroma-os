const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Starting full menu modifier patch...");

    // 1. Niah's Licuadito - Milk Type & Default Almond
    const niahId = 'cold_niahs_licuadito';
    const milkGroupId = '0d5d6d40-58aa-4fc7-8846-c3f4b3876636';
    const almondId = '136337fc-ad6b-41e0-b381-0ebadcd3d6a5';

    await supabase.from('item_modifier_groups').upsert({ item_id: niahId, group_id: milkGroupId, display_order: 1 }, { onConflict: 'item_id,group_id' });
    await supabase.from('menu_items').update({
        base_recipe: { [milkGroupId]: almondId }
    }).eq('id', niahId);
    console.log("Patched Niah's Licuadito.");

    // 2. Avocado Toast - Egg, Chili, Honey
    const avocadoId = 'food_avocado_toast_huevo';
    const eggGroupId = '27f0ddfb-7b2c-45dc-a0d9-69a126e83a6c';
    const chiliGroupId = '48eb7f40-c108-4d0a-9cb9-5d8712d695a1';
    const honeyGroupId = '66c6ab1c-2a93-43b9-9e60-6e7f2064011a';

    await supabase.from('item_modifier_groups').upsert([
        { item_id: avocadoId, group_id: eggGroupId, display_order: 1 },
        { item_id: avocadoId, group_id: chiliGroupId, display_order: 2 },
        { item_id: avocadoId, group_id: honeyGroupId, display_order: 3 }
    ], { onConflict: 'item_id,group_id' });
    console.log("Patched Avocado Toast.");

    // 3. Banana Almond Toast - Honey + New Strawberry Topping
    const bananaId = 'food_banano_almond_toast';
    // Create new group for Strawberry Topping
    const { data: toppingGroup, error: tgErr } = await supabase.from('modifier_groups').insert({
        name: 'Toppings (Banana Toast)',
        required: false,
        max_selections: 1
    }).select().single();

    if (toppingGroup) {
        await supabase.from('modifier_options').insert([
            { group_id: toppingGroup.id, name: 'No Strawberries', price_adjustment: 0, is_default: true },
            { group_id: toppingGroup.id, name: 'Add Strawberries', price_adjustment: 10, is_default: false }
        ]);
        await supabase.from('item_modifier_groups').upsert([
            { item_id: bananaId, group_id: honeyGroupId, display_order: 1 },
            { item_id: bananaId, group_id: toppingGroup.id, display_order: 2 }
        ], { onConflict: 'item_id,group_id' });
    }
    console.log("Patched Banana Almond Toast.");

    // 4. Crepes - Filling Options
    const crepeIds = ['food_crepas_1', 'food_crepas_3'];
    const { data: fillingGroup, error: fgErr } = await supabase.from('modifier_groups').insert({
        name: 'Crepe Filling',
        required: true,
        max_selections: 1
    }).select().single();

    if (fillingGroup) {
        const { data: fillingOpts } = await supabase.from('modifier_options').insert([
            { group_id: fillingGroup.id, name: 'Nutella', price_adjustment: 0, is_default: true },
            { group_id: fillingGroup.id, name: 'Strawberry', price_adjustment: 0, is_default: false },
            { group_id: fillingGroup.id, name: 'Condensed Milk', price_adjustment: 0, is_default: false }
        ]).select();

        for (const cid of crepeIds) {
            await supabase.from('item_modifier_groups').upsert({ item_id: cid, group_id: fillingGroup.id, display_order: 1 }, { onConflict: 'item_id,group_id' });
        }
    }
    console.log("Patched Crepes.");

    console.log("Full patch complete!");
}

run();
