const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Create Modifier Groups for Baleada
    
    // Group 1: Base (Queso, Mantequilla) - They usually have both, but maybe they want to omit?
    // "mods of queso, mantequilla" - let's make it a multi-select where both are default? Or a "Sin" (Without) group?
    // Let's create an "Ingredientes" multi-select where they can uncheck or check them.
    const { data: baseGrp } = await supabase.from('modifier_groups').insert({
        name: 'Ingredientes Base',
        required: true,
        max_selections: 2
    }).select().single();
    
    await supabase.from('modifier_options').insert([
        { group_id: baseGrp.id, name: 'Con Todo (Queso y Mantequilla)', price_adjustment: 0, is_default: true },
        { group_id: baseGrp.id, name: 'Solo Queso', price_adjustment: 0, is_default: false },
        { group_id: baseGrp.id, name: 'Solo Mantequilla', price_adjustment: 0, is_default: false },
        { group_id: baseGrp.id, name: 'Sin Lácteos', price_adjustment: 0, is_default: false }
    ]);

    // Group 2: Tostada (extra, normal, suave)
    const { data: tostadaGrp } = await supabase.from('modifier_groups').insert({
        name: 'Nivel de Tostado',
        required: true,
        max_selections: 1
    }).select().single();

    await supabase.from('modifier_options').insert([
        { group_id: tostadaGrp.id, name: 'Normal', price_adjustment: 0, is_default: true },
        { group_id: tostadaGrp.id, name: 'Extra Tostada', price_adjustment: 0, is_default: false },
        { group_id: tostadaGrp.id, name: 'Suave', price_adjustment: 0, is_default: false }
    ]);

    // Group 3: Extras (egg +10, avocado +20)
    const { data: extrasGrp } = await supabase.from('modifier_groups').insert({
        name: 'Extras (Add-ons)',
        required: false,
        max_selections: 2
    }).select().single();

    await supabase.from('modifier_options').insert([
        { group_id: extrasGrp.id, name: 'Huevo (Egg)', price_adjustment: 10, is_default: false },
        { group_id: extrasGrp.id, name: 'Aguacate (Avocado)', price_adjustment: 20, is_default: false }
    ]);

    // 2. Attach to Baleada
    const { data: baleadas } = await supabase.from('menu_items').select('*').ilike('name', '%Baleada%');
    console.log("Found Baleadas:", baleadas.map(b => b.name));

    for (const baleada of baleadas) {
        await supabase.from('item_modifier_groups').upsert([
            { item_id: baleada.id, group_id: baseGrp.id, display_order: 1 },
            { item_id: baleada.id, group_id: tostadaGrp.id, display_order: 2 },
            { item_id: baleada.id, group_id: extrasGrp.id, display_order: 3 }
        ]);
        console.log(`Attached mods to ${baleada.name}`);
    }
}
run();