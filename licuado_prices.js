const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Licuado Flavors group id from previous output
    const groupId = '7c3c4a79-f633-41ed-91b9-a417ab9a000d';
    
    // Update all options in this group to have +10 price
    const { data, error } = await supabase
        .from('modifier_options')
        .update({ price_adjustment: 10 })
        .eq('group_id', groupId)
        .select();
        
    if (error) {
        console.error('Error updating prices:', error);
    } else {
        console.log('Successfully updated prices to +10 for options:', data.map(d => d.name));
    }
}
run();
