const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '/Users/racs/clawd/projects/rich-aroma-os/.env.local'});
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Updating menu items...");

        // Hot Drinks
        await supabase.from('menu_items').update({ price: 55 }).ilike('name', 'Americano'); // 12oz is 55, 8oz is -10 (45)
        await supabase.from('menu_items').update({ price: 60 }).ilike('name', 'Cappuccino'); // 12oz is 60, 8oz is -5 (55)
        await supabase.from('menu_items').update({ price: 60 }).ilike('name', 'Latte'); // 12oz is 60, 8oz is -5 (55)
        await supabase.from('menu_items').update({ price: 90 }).ilike('name', 'Chai Latte'); // 12oz is 90, 8oz is -15 (75)
        await supabase.from('menu_items').update({ price: 75 }).ilike('name', 'Hot Chocolate'); // Only one size? Image just says 75
        await supabase.from('menu_items').update({ price: 60 }).ilike('name', 'Matcha Latte'); // Only one size? Image just says 60
        
        // Add TE (Te)
        const { data: teItems } = await supabase.from('menu_items').select('id').ilike('name', 'Te');
        if (!teItems || teItems.length === 0) {
            await supabase.from('menu_items').insert({
                id: 'hot_tea',
                name: 'Te',
                price: 45,
                category: 'hot_drinks',
                available: true
            });
        } else {
            await supabase.from('menu_items').update({ price: 45 }).ilike('name', 'Te');
        }

        // Cold Drinks
        await supabase.from('menu_items').update({ price: 75 }).ilike('name', 'Caramel Iced Coffee'); 
        await supabase.from('menu_items').update({ price: 85 }).ilike('name', 'French Vanilla'); 
        await supabase.from('menu_items').update({ price: 85 }).ilike('name', 'Chai Iced Latte'); // Might not exist, will create or update
        await supabase.from('menu_items').update({ price: 75 }).ilike('name', 'Iced Matcha');
        await supabase.from('menu_items').update({ price: 60 }).ilike('name', 'Licuado'); 
        await supabase.from('menu_items').update({ price: 95 }).ilike('name', 'Niah\'s Licuadito'); 

        // Juices / Granitas
        const { data: jugoItems } = await supabase.from('menu_items').select('id').ilike('name', 'Jugo');
        if (!jugoItems || jugoItems.length === 0) {
            await supabase.from('menu_items').insert({
                id: 'cold_jugo',
                name: 'Jugo',
                price: 50,
                category: 'cold_drinks',
                available: true
            });
        } else {
            await supabase.from('menu_items').update({ price: 50 }).eq('id', jugoItems[0].id); // Just the exact 'Jugo'
        }
        
        await supabase.from('menu_items').update({ price: 85 }).ilike('name', 'Granita de mango'); 
        await supabase.from('menu_items').update({ price: 85 }).ilike('name', 'Granita de limon'); 
        await supabase.from('menu_items').update({ price: 85 }).ilike('name', 'Fresa Granita'); 

        // Frappes
        await supabase.from('menu_items').update({ price: 90 }).ilike('name', 'Coffee Frappe'); // Assuming Café Frappe
        
        const { data: chaiFrappeItems } = await supabase.from('menu_items').select('id').ilike('name', 'Chai Frappe');
        if (!chaiFrappeItems || chaiFrappeItems.length === 0) {
            await supabase.from('menu_items').insert({
                id: 'frappe_chai',
                name: 'Chai Frappe',
                price: 90,
                category: 'frappes',
                available: true
            });
        } else {
            await supabase.from('menu_items').update({ price: 90 }).ilike('name', 'Chai Frappe');
        }
        
        await supabase.from('menu_items').update({ price: 100 }).ilike('name', 'Fresa Frappe'); 
        await supabase.from('menu_items').update({ price: 100 }).ilike('name', 'Supreme Frappe'); 

        // --- Modifiers ---
        console.log("Updating Modifier Options...");
        // Protein + 95, Creatine + 35, Cold Foam (Ube / Banano) + 20
        // I will add them to the relevant groups (e.g., Extras)
        
        const { data: extrasGroup } = await supabase.from('modifier_groups').select('id').eq('name', 'Extras (Add-ons)');
        if (extrasGroup && extrasGroup.length > 0) {
            const extId = extrasGroup[0].id;
            const extraOps = [
                { group_id: extId, name: 'Cold Foam Ube', price_adjustment: 20 },
                { group_id: extId, name: 'Cold Foam Banano', price_adjustment: 20 },
                { group_id: extId, name: 'Protein', price_adjustment: 95 },
                { group_id: extId, name: 'Creatine', price_adjustment: 35 }
            ];
            await supabase.from('modifier_options').upsert(extraOps, { onConflict: 'group_id, name' });
        }

        console.log("Finished updating prices and adding missing items based on the menu image.");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
