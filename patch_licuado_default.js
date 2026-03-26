const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("Looking for Banano under Sabores de Licuado...");
        
        // Find the group
        const { data: groups } = await supabase.from('modifier_groups').select('id').eq('name', 'Sabores de Licuado');
        if (!groups || groups.length === 0) {
            console.log("Could not find Sabores de Licuado group.");
            return;
        }
        const groupId = groups[0].id;

        // Set all to false first just to be safe
        await supabase.from('modifier_options').update({ is_default: false }).eq('group_id', groupId);

        // Set Banano to true
        const { error } = await supabase.from('modifier_options').update({ is_default: true }).eq('group_id', groupId).ilike('name', 'Banano');
        
        if (error) throw error;
        console.log("Successfully set Banano as the default option!");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
