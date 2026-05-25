const { supabase } = require('./lib/supabase');

async function checkRestaurants() {
    // Try to insert a dummy to see what happens or check via RPC if possible
    // Since we don't have many tools for schema, we'll try a minimal insert
    const { error } = await supabase.from('restaurants').insert({ id: 'test-schema-check' });
    console.log('Insert error (gives us hints):', error);
    
    // Also try to fetch columns from a table that definitely exists and has data
    const { data } = await supabase.from('menu_items').select('*').limit(1);
    console.log('Menu items columns:', Object.keys(data[0] || {}));
}

checkRestaurants();
