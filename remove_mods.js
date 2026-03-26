const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching groups and items...');
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    const { data: items } = await supabase.from('menu_items').select('*');
    
    const hc = items.find(i => i.name === 'Hot Chocolate');
    const fresa = items.find(i => i.name === 'Fresa Frappe');
    
    console.log('Hot Chocolate ID:', hc?.id);
    console.log('Fresa Frappe ID:', fresa?.id);
    
    if (hc) {
        // Find flavor group
        const flavorGroups = groups.filter(g => g.name.toLowerCase().includes('flavor'));
        console.log('Flavor groups:', flavorGroups.map(g => g.name));
        
        for (const fg of flavorGroups) {
            console.log(`Removing ${fg.name} from Hot Chocolate...`);
            const { error } = await supabase.from('item_modifier_groups')
                .delete()
                .match({ item_id: hc.id, group_id: fg.id });
            if (error) console.error('Error removing flavor from HC:', error);
            else console.log(`Successfully removed ${fg.name} from Hot Chocolate`);
        }
    }
    
    if (fresa) {
        const addOnGroups = groups.filter(g => g.name.toLowerCase().includes('frappe') || g.name.toLowerCase().includes('add on') || g.name.toLowerCase().includes('addons'));
        console.log('Frappe add-on groups:', addOnGroups.map(g => g.name));
        
        for (const ag of addOnGroups) {
            console.log(`Removing ${ag.name} from Fresa Frappe...`);
            const { error } = await supabase.from('item_modifier_groups')
                .delete()
                .match({ item_id: fresa.id, group_id: ag.id });
            if (error) console.error('Error removing add-ons from Fresa:', error);
            else console.log(`Successfully removed ${ag.name} from Fresa Frappe`);
        }
    }
}
run();
