const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching current modifiers...");
    
    // 1. Get Groups
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    const { data: options } = await supabase.from('modifier_options').select('*');
    
    const sizeGroup = groups.find(g => g.name.toLowerCase().includes('size') || g.name.toLowerCase().includes('tamaño'));
    const shotGroup = groups.find(g => g.name.toLowerCase().includes('shot') || g.name.toLowerCase().includes('espresso'));
    
    if (!sizeGroup || !shotGroup) {
        console.log("Missing Size or Shots group. Please ensure they exist.");
        return;
    }

    const size8 = options.find(o => o.group_id === sizeGroup.id && o.name.includes('8'));
    const size12 = options.find(o => o.group_id === sizeGroup.id && o.name.includes('12'));
    const shot1 = options.find(o => o.group_id === shotGroup.id && o.name.includes('1'));
    const shot2 = options.find(o => o.group_id === shotGroup.id && o.name.includes('2'));

    if (!size8 || !size12 || !shot1 || !shot2) {
        console.log("Missing specific options (8oz, 12oz, 1 Shot, 2 Shots).");
        return;
    }

    console.log("Building base recipe payload...");
    const baseRecipe = {};
    baseRecipe[size8.name] = { [shotGroup.id]: shot1.id };
    baseRecipe[size12.name] = { [shotGroup.id]: shot2.id };

    console.log("Applying to all hot coffees...");
    const { data: items } = await supabase.from('menu_items').select('*').eq('category', 'hot_coffee');
    
    for (const item of items) {
        await supabase.from('menu_items').update({ base_recipe: baseRecipe }).eq('id', item.id);
        console.log(`Updated ${item.name}`);
    }
    
    console.log("Done!");
}
run();
