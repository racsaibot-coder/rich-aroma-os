const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data } = await supabase.from('menu_items').select('name, base_recipe').ilike('name', '%Cappuccino%');
    console.log("Cappuccino Recipe:", JSON.stringify(data[0].base_recipe, null, 2));

    const { data: options } = await supabase.from('modifier_options').select('id, name, group_id').in('id', ['09bd08c4-8194-4e41-b551-1785c8d2f3f8', 'a93cf7b4-a6e4-4f4e-ab55-8fbc8e7478d1']);
    console.log("Target Options (Shots):", options);

    const { data: sizes } = await supabase.from('modifier_options').select('id, name').ilike('name', '%oz%');
    console.log("Size options:", sizes);
}
run();
