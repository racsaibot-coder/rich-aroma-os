const { createClient } = require('@supabase/supabase-js');
// Need to get supabase url and key
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // if exists

// Actually, I can just require the existing lib
const { supabase } = require('./api/lib/supabase.js');

const fallbackImages = {
    'hot_cappuccino': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80',
    'hot_latte': 'https://images.unsplash.com/photo-1570968992272-1512fdad694d?w=400&q=80',
    'hot_americano': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80',
    'hot_chai_latte': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80',
    'hot_dirty_chai': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80',
    'hot_chocolate': 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80',
    'hot_matcha_latte': 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80',
    'hot_dirty_matcha': 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80',
    'hot_mocha': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80',
    'cold_caramel_iced': 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80',
    'cold_french_vanilla': 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80',
    'cold_iced_matcha': 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80',
    'cold_supreme_frappe': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80',
    'cold_fresa_frappe': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80',
    'cold_coffee_frappe': 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80',
    'cold_magoneada': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'cold_mango_granita': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'cold_lemonade_granita': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'cold_fresa_granita': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'cold_licuado': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'cold_niahs_licuadito': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'food_chicken_hummus': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
    'food_bean_rice': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
    'food_acai_bowl': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80',
    'food_acai_cup': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80',
    'food_burgers_fries': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    'food_sourdough_ham': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
    'food_grill_cheese': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80'
};

async function updateImages() {
    console.log("Updating images in Supabase...");
    
    // First let's see what items we have
    const { data: items, error } = await supabase.from('menu_items').select('*');
    if (error) {
        console.error("Error fetching items:", error);
        return;
    }
    
    for (const item of items) {
        let img = fallbackImages[item.id];
        
        // If we don't have an exact ID match, try to match by name
        if (!img) {
            const name = item.name.toLowerCase();
            if (name.includes('cappuccino') || name.includes('capuchino')) img = fallbackImages['hot_cappuccino'];
            else if (name.includes('latte')) img = fallbackImages['hot_latte'];
            else if (name.includes('americano')) img = fallbackImages['hot_americano'];
            else if (name.includes('matcha')) img = fallbackImages['hot_matcha_latte'];
            else if (name.includes('mocha') || name.includes('moca')) img = fallbackImages['hot_mocha'];
            else if (name.includes('chai')) img = fallbackImages['hot_chai_latte'];
            else if (name.includes('cold brew')) img = fallbackImages['cold_caramel_iced'];
            else if (name.includes('frappe')) img = fallbackImages['cold_coffee_frappe'];
            else if (name.includes('granita') || name.includes('licuado')) img = fallbackImages['cold_mango_granita'];
            else if (name.includes('açaí') || name.includes('acai')) img = fallbackImages['food_acai_bowl'];
            else if (name.includes('crêpe') || name.includes('crepe')) img = 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&q=80';
            else if (item.category === 'food') img = 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80';
            else img = 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80'; // generic coffee
        }
        
        if (img) {
            await supabase.from('menu_items').update({ image_url: img }).eq('id', item.id);
            console.log(`Updated ${item.name} with image: ${img}`);
        }
    }
    console.log("Done!");
}

updateImages();
