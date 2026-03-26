const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    const { data: options } = await supabase.from('modifier_options').select('*');
    
    const groupMap = {};
    for (const g of groups) groupMap[g.name] = g.id;
    
    const optMap = {};
    for (const o of options) optMap[`${o.group_id}_${o.name}`] = o.id;

    const links = [];
    const baseRecipes = {};
    
    const link = (itemId, groupName, order) => {
        if (groupMap[groupName]) {
            links.push({ item_id: itemId, group_id: groupMap[groupName], display_order: order });
        }
    };

    // Hot Coffees
    ['hot_americano', 'hot_cappuccino', 'hot_latte'].forEach(id => {
        const sizeGrp = id === 'hot_americano' ? 'Size (Americano)' : 'Size (Cappuccino/Latte)';
        link(id, sizeGrp, 1);
        link(id, 'Espresso Shots', 2);
        if (id !== 'hot_americano') link(id, 'Milk Type', 3);

        const gIdShots = groupMap['Espresso Shots'];
        if (gIdShots) {
            baseRecipes[id] = {
                "8oz": { [gIdShots]: optMap[`${gIdShots}_1 Shot`] },
                "12oz": { [gIdShots]: optMap[`${gIdShots}_2 Shots`] }
            };
        }
    });

    ['hot_chai_latte', 'hot_matcha_latte'].forEach(id => {
        link(id, 'Size (Chai/Matcha)', 1);
        link(id, 'Milk Type', 2);
        link(id, 'Add Espresso', 3);
    });

    // Cold Drinks
    ['cold_caramel_iced', 'cold_french_vanilla', 'cold_chai_iced'].forEach(id => {
        link(id, 'Milk Type', 1);
    });
    link('cold_iced_matcha', 'Milk Type', 1);
    link('cold_iced_matcha', 'Honey', 2);

    // Licuados & Jugos
    link('cold_licuado', 'Flavor', 1);
    link('cold_licuado', 'Extra Flavors (+10)', 2);
    link('cold_licuado', 'Milk Type', 3);

    // Assuming we didn't differentiate names perfectly for jugo flavors vs licuado flavors,
    // let's just query db to see what the exact IDs are if we need to.
    
    // Frappes
    link('cold_supreme_frappe', 'Milk Type', 1);
    link('cold_supreme_frappe', 'Drizzle', 2);

    ['cold_coffee_frappe', 'cold_chai_frappe', 'cold_fresa_frappe'].forEach(id => {
        link(id, 'Milk Type', 1);
        link(id, 'Frappe Add-ons', 2);
    });

    console.log("Links:", links.length);
    for (const l of links) {
        const { error } = await supabase.from('item_modifier_groups').upsert(l);
        if (error) console.log("Link error:", error);
    }
    
    console.log("Recipes:", Object.keys(baseRecipes).length);
    for (const [itemId, recipe] of Object.entries(baseRecipes)) {
        const { error } = await supabase.from('menu_items').update({ base_recipe: recipe }).eq('id', itemId);
        if (error) console.log("Recipe error:", error);
    }
    console.log("Done");
}
run();
