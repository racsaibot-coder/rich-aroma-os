const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1 bottle is $5 (implied) or we can just offer it. Form doesn't list individual prices, 
    // just says Bundle is 14. 
    // Let's create the items
    
    const products = [
        { name: "Vanilla", price: 5.00, bottles_per_pack: 1, inventory_limit: null, active: true },
        { name: "Caramel", price: 5.00, bottles_per_pack: 1, inventory_limit: null, active: true },
        { name: "Oreo Supreme", price: 5.00, bottles_per_pack: 1, inventory_limit: null, active: true },
        { name: "French Vanilla", price: 5.00, bottles_per_pack: 1, inventory_limit: null, active: true },
        
        { name: "Bundle of 3 (Mix)", price: 14.00, bottles_per_pack: 3, inventory_limit: null, active: true }
    ];

    const { data, error } = await supabase.from('cali_products').insert(products);
    if(error) {
        console.error("Error inserting products:", error);
    } else {
        console.log("Products inserted!");
    }

    const locations = [
        { name: "Main Pickup", city: "Pickup Sunday", distributor_name: "Cali Base", active: true },
        { name: "Partner Pickup Location", city: "TBD", distributor_name: "Partner", active: true }
    ];

    const { error: locErr } = await supabase.from('cali_locations').insert(locations);
    if(locErr) {
        console.error("Error inserting locations:", locErr);
    } else {
        console.log("Locations inserted!");
    }
}
run();