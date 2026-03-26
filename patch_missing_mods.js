require('dotenv').config({path: '/Users/racs/clawd/projects/rich-aroma-os/.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Fetching menu items...");
        const { data: menu } = await supabase.from('menu_items').select('id, name');
        
        const americano = menu.find(m => m.name.toLowerCase().includes('americano'));
        const matcha = menu.find(m => m.name.toLowerCase().includes('matcha'));
        const licuado = menu.find(m => m.name.toLowerCase().includes('licuado'));

        console.log("Fetching modifier groups...");
        const { data: groups } = await supabase.from('modifier_groups').select('*');
        
        // Helper to find group
        const getGroupId = (nameMatch) => {
            const g = groups.find(g => g.name.toLowerCase().includes(nameMatch.toLowerCase()));
            return g ? g.id : null;
        };

        // 1. AMERICANO
        if (americano) {
            console.log("Patching Americano...");
            const sizeAmId = getGroupId('Size (Americano)') || getGroupId('Size');
            const shotsId = getGroupId('Espresso Shots');
            
            if (sizeAmId) {
                await supabase.from('item_modifier_groups').upsert({ item_id: americano.id, group_id: sizeAmId, display_order: 1 });
            }
            if (shotsId) {
                await supabase.from('item_modifier_groups').upsert({ item_id: americano.id, group_id: shotsId, display_order: 2 });
            }
        }

        // 2. MATCHA
        if (matcha) {
            console.log("Patching Matcha...");
            const milkId = getGroupId('Milk Type');
            const addEspressoId = getGroupId('Add Espresso');
            
            if (milkId) {
                await supabase.from('item_modifier_groups').upsert({ item_id: matcha.id, group_id: milkId, display_order: 2 });
            }
            if (addEspressoId) {
                await supabase.from('item_modifier_groups').upsert({ item_id: matcha.id, group_id: addEspressoId, display_order: 3 });
            }
        }

        // 3. LICUADO
        if (licuado) {
            console.log("Patching Licuado...");
            // Create a specific "Licuado Flavors (+10)" group
            let licuadoGroup = groups.find(g => g.name === 'Sabores de Licuado');
            if (!licuadoGroup) {
                const { data: newGroup } = await supabase.from('modifier_groups').insert({
                    name: 'Sabores de Licuado',
                    required: true,
                    max_selections: 5 // allows multiple
                }).select().single();
                licuadoGroup = newGroup;
                
                // Add options
                await supabase.from('modifier_options').insert([
                    { group_id: licuadoGroup.id, name: 'Banano', price_adjustment: 10, is_default: false },
                    { group_id: licuadoGroup.id, name: 'Avena', price_adjustment: 10, is_default: false },
                    { group_id: licuadoGroup.id, name: 'Granola', price_adjustment: 10, is_default: false },
                    { group_id: licuadoGroup.id, name: 'Fresa', price_adjustment: 10, is_default: false }
                ]);
            }
            
            await supabase.from('item_modifier_groups').upsert({ item_id: licuado.id, group_id: licuadoGroup.id, display_order: 1 });
            
            // It might also need milk type? Adding it just in case
            const milkId = getGroupId('Milk Type');
            if (milkId) {
                await supabase.from('item_modifier_groups').upsert({ item_id: licuado.id, group_id: milkId, display_order: 2 });
            }
        }

        console.log("Done patching missing modifiers!");

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
