const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://zcqubacfcettwawcimsy.supabase.co', 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq');

async function run() {
    const { data: mochas } = await supabase.from('menu_items').select('id, name, base_recipe').ilike('name', '%Mocha%');
    console.log('Mochas found:', mochas);
    
    for(const mocha of mochas) {
        // Prepare base recipe 
        const recipe = {
            "8oz": [
                { id: "inv_espresso", name: "Espresso", qty: 0.5, unit: "oz" },
                { id: "inv_milk_whole", name: "Whole Milk", qty: 6.5, unit: "oz" },
                { id: "inv_choco_syrup", name: "Chocolate Syrup", qty: 1, unit: "pump" }
            ],
            "12oz": [
                { id: "inv_espresso", name: "Espresso", qty: 1, unit: "oz" },
                { id: "inv_milk_whole", name: "Whole Milk", qty: 9, unit: "oz" },
                { id: "inv_choco_syrup", name: "Chocolate Syrup", qty: 2, unit: "pump" }
            ]
        };

        const { data, error } = await supabase.from('menu_items')
            .update({ base_recipe: recipe })
            .eq('id', mocha.id)
            .select();
            
        console.log(`Updated base_recipe for ${mocha.name}:`, error ? error.message : 'Success');
    }
}
run();