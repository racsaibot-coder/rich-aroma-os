const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    const { data: items } = await supabase.from('menu_items').select('*');
    
    const licuado = items.find(i => i.name === 'Licuado');
    console.log('Licuado ID:', licuado?.id);
    
    if (licuado) {
        // Find existing modifiers assigned to licuado
        const { data: itemMods } = await supabase.from('item_modifier_groups').select('*').eq('item_id', licuado.id);
        console.log('Current item_modifier_groups for Licuado:', itemMods);
        
        for (const im of itemMods) {
            const groupName = groups.find(g => g.id === im.group_id)?.name;
            console.log(`- ${groupName} (${im.group_id})`);
            
            if (groupName && (groupName.toLowerCase() === 'flavor' || groupName.toLowerCase().includes('extra flavors'))) {
                console.log(`Removing ${groupName}...`);
                await supabase.from('item_modifier_groups').delete().eq('item_id', licuado.id).eq('group_id', im.group_id);
            }
        }
        
        // Ensure "Licuado Flavors" is added
        const licuadoFlavors = groups.find(g => g.name === 'Licuado Flavors');
        console.log('Found Licuado Flavors group:', licuadoFlavors);
        
        if (licuadoFlavors) {
            await supabase.from('item_modifier_groups').upsert({
                item_id: licuado.id,
                group_id: licuadoFlavors.id,
                display_order: 1
            });
            console.log('Added Licuado Flavors modifier');
        }
        
        // Show options for Licuado Flavors
        if (licuadoFlavors) {
            const { data: options } = await supabase.from('modifier_options').select('*').eq('group_id', licuadoFlavors.id);
            console.log('Options for Licuado Flavors:', options);
        }
    }
}
run();
