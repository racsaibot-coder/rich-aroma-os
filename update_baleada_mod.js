const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Find the Ingredientes Base group
    const { data: groups } = await supabase.from('modifier_groups')
        .select('*')
        .ilike('name', '%Ingredientes Base%');
        
    console.log('Found groups:', groups);
    
    if (groups && groups.length > 0) {
        const groupId = groups[0].id;
        
        // Update the max_selections to 1
        const { data, error } = await supabase
            .from('modifier_groups')
            .update({ max_selections: 1 })
            .eq('id', groupId)
            .select();
            
        if (error) {
            console.error('Error updating max_selections:', error);
        } else {
            console.log('Successfully updated max_selections to 1 for:', data[0].name);
        }
    } else {
        console.log('Could not find Ingredientes Base group');
    }
}
run();
