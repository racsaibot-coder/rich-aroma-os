const { supabase } = require('./lib/supabase');

async function checkColumns() {
    const { data, error } = await supabase.from('orders').select('*').limit(1);
    if (error) {
        console.error('Error fetching order:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in orders table:', Object.keys(data[0]));
    } else {
        console.log('No orders found to check columns.');
        // Try to fetch from another table or use a different method if possible
    }
}

checkColumns();
