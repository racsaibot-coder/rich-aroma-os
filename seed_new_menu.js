const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Starting menu & modifier setup...");

    // 1. Wipe existing modifiers to start fresh and clean
    console.log("Clearing old modifiers...");
    await supabase.from('modifier_options').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('item_modifier_groups').delete().neq('item_id', 'none');
    await supabase.from('modifier_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Define Groups
    const groupsToCreate = [
        { id: 'g_size_americano', name: 'Size (Americano)', required: true, max_selections: 1 },
        { id: 'g_size_capp', name: 'Size (Cappuccino/Latte)', required: true, max_selections: 1 },
        { id: 'g_size_chai', name: 'Size (Chai/Matcha)', required: true, max_selections: 1 },
        { id: 'g_size_jugo', name: 'Style', required: true, max_selections: 1 },
        { id: 'g_shots', name: 'Espresso Shots', required: true, max_selections: 1 },
        { id: 'g_milk', name: 'Milk Type', required: true, max_selections: 1 },
        { id: 'g_add_shot', name: 'Add Espresso', required: false, max_selections: 2 },
        { id: 'g_honey', name: 'Honey', required: true, max_selections: 1 },
        { id: 'g_lic_flavor', name: 'Flavor', required: true, max_selections: 1 },
        { id: 'g_lic_extra', name: 'Extra Flavors (+10)', required: false, max_selections: 3 },
        { id: 'g_jugo_flavor', name: 'Flavor', required: true, max_selections: 1 },
        { id: 'g_jugo_extra', name: 'Extra Flavors (+10)', required: false, max_selections: 3 },
        { id: 'g_drizzle_sup', name: 'Drizzle', required: true, max_selections: 1 },
        { id: 'g_frappe_add', name: 'Frappe Add-ons', required: false, max_selections: 3 }
    ];

    const groupMap = {};
    for (const g of groupsToCreate) {
        const { data } = await supabase.from('modifier_groups').insert({ name: g.name, required: g.required, max_selections: g.max_selections }).select().single();
        groupMap[g.id] = data.id;
    }

    // 3. Define Options
    const optionsToCreate = [
        // Size Americano
        { group_id: groupMap['g_size_americano'], name: '8oz', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_size_americano'], name: '12oz', price_adjustment: 10, is_default: false },
        
        // Size Capp
        { group_id: groupMap['g_size_capp'], name: '8oz', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_size_capp'], name: '12oz', price_adjustment: 5, is_default: false },
        
        // Size Chai
        { group_id: groupMap['g_size_chai'], name: '8oz', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_size_chai'], name: '12oz', price_adjustment: 15, is_default: false },

        // Style Jugo
        { group_id: groupMap['g_size_jugo'], name: 'Normal (Agua + Hielo)', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_size_jugo'], name: 'Granita (Blended Icy)', price_adjustment: 35, is_default: false },

        // Shots
        { group_id: groupMap['g_shots'], name: '1 Shot', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_shots'], name: '2 Shots', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_shots'], name: '3 Shots', price_adjustment: 15, is_default: false },
        { group_id: groupMap['g_shots'], name: '4 Shots', price_adjustment: 30, is_default: false },
        { group_id: groupMap['g_shots'], name: 'Decaf', price_adjustment: 0, is_default: false },

        // Milk
        { group_id: groupMap['g_milk'], name: 'Regular', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_milk'], name: 'Deslactosada', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_milk'], name: 'Descremada', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_milk'], name: 'Almond', price_adjustment: 15, is_default: false },
        { group_id: groupMap['g_milk'], name: 'Oat', price_adjustment: 20, is_default: false },

        // Add Shot
        { group_id: groupMap['g_add_shot'], name: '+1 Shot', price_adjustment: 15, is_default: false },
        { group_id: groupMap['g_add_shot'], name: '+2 Shots', price_adjustment: 30, is_default: false },

        // Honey
        { group_id: groupMap['g_honey'], name: 'Normal Honey (1 tbsp)', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_honey'], name: 'Less Honey', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_honey'], name: 'Extra Honey', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_honey'], name: 'No Honey', price_adjustment: 0, is_default: false },

        // Lic Flavors
        { group_id: groupMap['g_lic_flavor'], name: 'Banana', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_lic_flavor'], name: 'Granola', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_lic_flavor'], name: 'Avena', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_lic_extra'], name: 'Banana', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_lic_extra'], name: 'Granola', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_lic_extra'], name: 'Avena', price_adjustment: 10, is_default: false },

        // Jugo Flavors
        { group_id: groupMap['g_jugo_flavor'], name: 'Fresa', price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_jugo_flavor'], name: 'Mango', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_jugo_flavor'], name: 'Limon', price_adjustment: 0, is_default: false },
        { group_id: groupMap['g_jugo_extra'], name: 'Fresa', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_jugo_extra'], name: 'Mango', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_jugo_extra'], name: 'Limon', price_adjustment: 10, is_default: false },

        // Drizzle Sup
        { group_id: groupMap['g_drizzle_sup'], name: "Chocolate Hershey's", price_adjustment: 0, is_default: true },
        { group_id: groupMap['g_drizzle_sup'], name: 'Caramel', price_adjustment: 0, is_default: false },

        // Frappe Addons
        { group_id: groupMap['g_frappe_add'], name: 'Whip Cream', price_adjustment: 10, is_default: false },
        { group_id: groupMap['g_frappe_add'], name: 'Chocolate Drizzle', price_adjustment: 5, is_default: false },
        { group_id: groupMap['g_frappe_add'], name: 'Caramel Drizzle', price_adjustment: 5, is_default: false }
    ];

    const optMap = {};
    for (const o of optionsToCreate) {
        const { data } = await supabase.from('modifier_options').insert(o).select().single();
        optMap[`${o.group_id}_${o.name}`] = data.id;
    }

    // 4. Define Menu Items
    const menuItems = [
        { id: 'americano', name: 'Americano', category: 'hot_coffee', price: 45, description: 'Base 8oz: 1 shot, 7oz water. 12oz: 2 shots, 10oz water.' },
        { id: 'cappuccino', name: 'Cappuccino', category: 'hot_coffee', price: 55, description: 'Base 8oz: 1 shot, 7oz milk. 12oz: 2 shots, 10oz milk.' },
        { id: 'latte', name: 'Latte', category: 'hot_coffee', price: 55, description: 'Same recipe as Cappuccino.' },
        { id: 'chai_latte', name: 'Chai Latte', category: 'hot_coffee', price: 75, description: 'Base 8oz: 7oz milk. 12oz: 10oz milk.' },
        { id: 'matcha_latte', name: 'Matcha Latte', category: 'hot_coffee', price: 60, description: 'Choice of milk.' },
        
        { id: 'caramel_iced_coffee', name: 'Caramel Iced Coffee', category: 'iced_coffee', price: 75, description: '16oz. 2oz espresso, 1.5 tbsp sugar, 8oz milk, 8oz ice.' },
        { id: 'vainilla_francesa', name: 'Vainilla Francesa Iced', category: 'iced_coffee', price: 85, description: '16oz. 2oz espresso, 8oz milk, 8oz ice.' },
        { id: 'chai_iced', name: 'Chai Iced Latte', category: 'iced_drinks', price: 85, description: '16oz. 8oz milk, 8oz ice.' },
        { id: 'matcha_iced', name: 'Matcha Iced', category: 'iced_drinks', price: 85, description: '16oz. 8oz milk, 8oz ice, 1 tbsp honey.' },
        
        { id: 'licuado', name: 'Licuado', category: 'drinks', price: 60, description: 'Base 1 flavor. +10 per extra flavor. 4oz ice.' },
        { id: 'jugo_natural', name: 'Jugos Naturales', category: 'drinks', price: 50, description: 'Base 50. +10 extra flavor. Granita style +35.' },
        
        { id: 'supreme_frappe', name: 'Supreme Frappe', category: 'frappe', price: 100, description: '16oz. 8oz milk, 2oz espresso, 3 oreos.' },
        { id: 'coffee_frappe', name: 'Coffee Frappe', category: 'frappe', price: 80, description: '16oz. 8oz milk, 2oz espresso.' },
        { id: 'chai_frappe', name: 'Chai Frappe', category: 'frappe', price: 85, description: '16oz. 8oz milk.' },
        { id: 'fresa_frappe', name: 'Fresa Frappe', category: 'frappe', price: 80, description: '16oz. 8oz milk.' }
    ];

    for (const item of menuItems) {
        await supabase.from('menu_items').upsert({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            description: item.description,
            available: true
        });
    }

    // 5. Link Modifiers & Setup Base Recipes
    const links = [];
    const baseRecipes = {};

    // Helper
    const link = (itemId, groupId, order) => links.push({ item_id: itemId, group_id: groupId, display_order: order });

    // Hot Coffees
    ['americano', 'cappuccino', 'latte'].forEach(id => {
        const sizeGrp = id === 'americano' ? groupMap['g_size_americano'] : groupMap['g_size_capp'];
        link(id, sizeGrp, 1);
        link(id, groupMap['g_shots'], 2);
        if (id !== 'americano') link(id, groupMap['g_milk'], 3);

        baseRecipes[id] = {
            "8oz": { [groupMap['g_shots']]: optMap[`${groupMap['g_shots']}_1 Shot`] },
            "12oz": { [groupMap['g_shots']]: optMap[`${groupMap['g_shots']}_2 Shots`] }
        };
    });

    ['chai_latte', 'matcha_latte'].forEach(id => {
        link(id, groupMap['g_size_chai'], 1);
        link(id, groupMap['g_milk'], 2);
        link(id, groupMap['g_add_shot'], 3);
    });

    // Cold Drinks
    ['caramel_iced_coffee', 'vainilla_francesa', 'chai_iced'].forEach(id => {
        link(id, groupMap['g_milk'], 1);
    });
    link('matcha_iced', groupMap['g_milk'], 1);
    link('matcha_iced', groupMap['g_honey'], 2);

    // Licuados & Jugos
    link('licuado', groupMap['g_lic_flavor'], 1);
    link('licuado', groupMap['g_lic_extra'], 2);
    link('licuado', groupMap['g_milk'], 3);

    link('jugo_natural', groupMap['g_size_jugo'], 1);
    link('jugo_natural', groupMap['g_jugo_flavor'], 2);
    link('jugo_natural', groupMap['g_jugo_extra'], 3);

    // Frappes
    link('supreme_frappe', groupMap['g_milk'], 1);
    link('supreme_frappe', groupMap['g_drizzle_sup'], 2);

    ['coffee_frappe', 'chai_frappe', 'fresa_frappe'].forEach(id => {
        link(id, groupMap['g_milk'], 1);
        link(id, groupMap['g_frappe_add'], 2);
    });

    console.log("Inserting links...");
    await supabase.from('item_modifier_groups').insert(links);

    console.log("Updating base recipes...");
    for (const [itemId, recipe] of Object.entries(baseRecipes)) {
        await supabase.from('menu_items').update({ base_recipe: recipe }).eq('id', itemId);
    }

    console.log("Database seeded successfully!");
}
run();