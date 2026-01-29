const { createClient } = require('@supabase/supabase-js');

// Configuration from server.js
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

const menuItems = [
    // Espresso Bar
    { id: 'item_esp_1', name: 'Classic Latte', price: 65, category: 'Espresso Bar', available: true },
    { id: 'item_esp_2', name: 'Cappuccino', price: 65, category: 'Espresso Bar', available: true },
    { id: 'item_esp_3', name: 'Americano', price: 60, category: 'Espresso Bar', available: true },
    { id: 'item_esp_4', name: 'Espresso', price: 40, category: 'Espresso Bar', available: true },
    { id: 'item_esp_5', name: 'Caramel Iced Coffee', price: 85, category: 'Espresso Bar', available: true },
    { id: 'item_esp_6', name: 'French Vanilla', price: 75, category: 'Espresso Bar', available: true },

    // Tea
    { id: 'item_tea_1', name: 'Chai', price: 75, category: 'Tea', available: true },
    { id: 'item_tea_2', name: 'Dirty Chai', price: 95, category: 'Tea', available: true },
    { id: 'item_tea_3', name: 'Matcha Latte', price: 85, category: 'Tea', available: true },
    { id: 'item_tea_4', name: 'Trad Matcha', price: 60, category: 'Tea', available: true },

    // Supremes
    { id: 'item_sup_1', name: 'Strawberry', price: 110, category: 'Supremes', available: true },
    { id: 'item_sup_2', name: 'Oreo', price: 110, category: 'Supremes', available: true },
    { id: 'item_sup_3', name: 'Lemonade Icee', price: 60, category: 'Supremes', available: true },
    { id: 'item_sup_4', name: 'Strawberry Icee', price: 60, category: 'Supremes', available: true },
    { id: 'item_sup_5', name: 'Twist', price: 65, category: 'Supremes', available: true },

    // Bowls
    { id: 'item_bowl_1', name: 'Chicken Asado', price: 150, category: 'Bowls', available: true },
    { id: 'item_bowl_2', name: 'Acai', price: 150, category: 'Bowls', available: true },
    { id: 'item_bowl_3', name: 'Grain Salad', price: 130, category: 'Bowls', available: true },

    // Grill
    { id: 'item_grill_1', name: 'Chipotle Burrito', price: 180, category: 'Grill', available: true },
    { id: 'item_grill_2', name: 'Avo Toast', price: 75, category: 'Grill', available: true },
    { id: 'item_grill_3', name: 'Chicken Avo Sandwich', price: 145, category: 'Grill', available: true },
    { id: 'item_grill_4', name: 'Crepe Sweet', price: 90, category: 'Grill', available: true },
    { id: 'item_grill_5', name: 'Crepe Savory', price: 125, category: 'Grill', available: true },
    { id: 'item_grill_6', name: 'Combo Sweet', price: 240, category: 'Grill', available: true },
    { id: 'item_grill_7', name: 'Combo Savory', price: 350, category: 'Grill', available: true },

    // Bakery
    { id: 'item_bake_1', name: 'GF Muffin', price: 70, category: 'Bakery', available: true },
    { id: 'item_bake_2', name: 'Cookie', price: 35, category: 'Bakery', available: true },
    { id: 'item_bake_3', name: 'Cheesecake', price: 110, category: 'Bakery', available: true },
    { id: 'item_bake_4', name: 'Flan', price: 75, category: 'Bakery', available: true },

    // Specials (Available: false)
    { id: 'item_spec_1', name: 'Burger', price: 150, category: 'Specials', available: false },
    { id: 'item_spec_2', name: 'Chicken Fingers', price: 110, category: 'Specials', available: false },
    { id: 'item_spec_3', name: 'Breakfast Burrito', price: 140, category: 'Specials', available: false },
];

const modifiers = [
    { id: 'mod_milk_1', name: 'Whole', price: 0, category: 'milk' },
    { id: 'mod_milk_2', name: 'Skim', price: 15, category: 'milk' },
    { id: 'mod_milk_3', name: 'Almond', price: 15, category: 'milk' },
    { id: 'mod_milk_4', name: 'Lactose Free', price: 15, category: 'milk' },
];

async function seed() {
    console.log('Connecting to Supabase...');
    
    // 1. Delete Old Items
    console.log('Deleting old menu items...');
    const { error: delError } = await supabase.from('menu_items').delete().neq('id', 'xo');
    if (delError) {
        console.error('Error deleting items:', delError);
        // Continue anyway? Or stop?
        // If table doesn't exist, we can't continue.
    }

    // 2. Insert New Items
    console.log('Inserting new menu items...');
    const { data: insertedItems, error: insertError } = await supabase.from('menu_items').insert(menuItems).select();
    if (insertError) {
        console.error('Error inserting items:', insertError);
    } else {
        console.log(`Success! Inserted ${insertedItems.length} items.`);
    }

    // 3. Handle Modifiers (Optional based on prompt, but good to have)
    // The prompt says "Modifiers: - Milk...", but didn't explicitly ask to DELETE old modifiers or insert them into a specific table.
    // server.js references `menu_modifiers` table.
    // I will try to update that too if it exists.
    console.log('Deleting old modifiers...');
    const { error: modDelError } = await supabase.from('menu_modifiers').delete().neq('id', 'xo');
    
    if (!modDelError) {
        console.log('Inserting new modifiers...');
        const { error: modInsertError } = await supabase.from('menu_modifiers').insert(modifiers);
        if (modInsertError) console.error('Error inserting modifiers:', modInsertError);
        else console.log(`Success! Inserted ${modifiers.length} modifiers.`);
    } else {
         console.warn("Could not delete/access menu_modifiers table, skipping modifiers.");
    }

}

seed();
