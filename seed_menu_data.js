const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

const menuItems = [
    // Hot Drinks
    { id: 'hot_cappuccino', name: 'Cappuccino', price: 55, category: 'coffee', available: true },
    { id: 'hot_latte', name: 'Latte', price: 55, category: 'coffee', available: true },
    { id: 'hot_americano', name: 'Americano', price: 40, category: 'coffee', available: true },
    { id: 'hot_chai_latte', name: 'Chai Latte', price: 60, category: 'coffee', available: true },
    { id: 'hot_dirty_chai', name: 'Dirty Chai', price: 75, category: 'coffee', available: true },
    { id: 'hot_chocolate', name: 'Hot Chocolate', price: 50, category: 'coffee', available: true },
    { id: 'hot_matcha_latte', name: 'Matcha Latte', price: 70, category: 'coffee', available: true },
    { id: 'hot_dirty_matcha', name: 'Dirty Matcha', price: 85, category: 'coffee', available: true },
    { id: 'hot_mocha', name: 'Mocha', price: 65, category: 'coffee', available: true },

    // Cold Drinks (16oz)
    { id: 'cold_caramel_iced', name: 'Caramel Iced Coffee', price: 60, category: 'drinks', available: true },
    { id: 'cold_french_vanilla', name: 'French Vanilla Chai', price: 65, category: 'drinks', available: true },
    { id: 'cold_iced_matcha', name: 'Iced Matcha', price: 70, category: 'drinks', available: true },
    { id: 'cold_supreme_frappe', name: 'Supreme Frappe', price: 80, category: 'drinks', available: true },
    { id: 'cold_fresa_frappe', name: 'Fresa Frappe', price: 75, category: 'drinks', available: true },
    { id: 'cold_coffee_frappe', name: 'Coffee Frappe', price: 70, category: 'drinks', available: true },
    { id: 'cold_magoneada', name: 'Magoneada', price: 65, category: 'drinks', available: true },
    { id: 'cold_mango_granita', name: 'Mango Granita', price: 55, category: 'drinks', available: true },
    { id: 'cold_lemonade_granita', name: 'Lemonade Granita', price: 55, category: 'drinks', available: true },
    { id: 'cold_fresa_granita', name: 'Fresa Granita', price: 55, category: 'drinks', available: true },
    { id: 'cold_licuado', name: 'Licuado', price: 60, category: 'drinks', available: true },
    { id: 'cold_niahs_licuadito', name: "Niah's Licuadito", price: 50, category: 'drinks', available: true },

    // Food
    { id: 'food_chicken_hummus', name: 'Chicken Salad Bowl w/ Hummus', price: 140, category: 'food', available: true },
    { id: 'food_bean_rice', name: 'Bean & Rice Bowl w/ Pico', price: 120, category: 'food', available: true },
    { id: 'food_acai_bowl', name: 'Açaí Bowl', price: 125, category: 'food', available: true },
    { id: 'food_acai_cup', name: 'Açaí Cup', price: 85, category: 'food', available: true },
    { id: 'food_burgers_fries', name: 'Burgers and Fries', price: 150, category: 'food', available: true },
    { id: 'food_sourdough_ham', name: 'Sourdough Ham/Turkey', price: 110, category: 'food', available: true },
    { id: 'food_grill_cheese', name: 'Grill Cheese', price: 80, category: 'food', available: true }
];

async function seed() {
    console.log('Connecting to Supabase...');
    
    console.log('Deleting old menu items...');
    const { error: delError } = await supabase.from('menu_items').delete().neq('id', 'xo');
    if (delError) console.error('Error deleting items:', delError);

    console.log('Inserting new menu items...');
    const { data: insertedItems, error: insertError } = await supabase.from('menu_items').insert(menuItems).select();
    if (insertError) {
        console.error('Error inserting items:', insertError);
    } else {
        console.log(`Success! Inserted ${insertedItems.length} items.`);
    }
}

seed();