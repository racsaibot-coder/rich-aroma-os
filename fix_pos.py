import re

with open('public/pos-v2.html', 'r') as f:
    content = f.read()

menu_str = """let menu = [];

    // --- INIT ---
    window.onload = async () => {
        try {
            const res = await fetch('/api/menu');
            const data = await res.json();
            if (data && data.items) {
                menu = data.items.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: i.price,
                    category: i.category,
                    icon: "☕",
                    image: i.image_url || "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80"
                }));
            }
        } catch (e) {
            console.error("Failed to load menu", e);
        }
        
        // Fallback if DB empty
        if (menu.length === 0) {
            menu = [
                { id: 'hot_cappuccino', name: 'Cappuccino', price: 55, category: 'coffee', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80' },
                { id: 'hot_latte', name: 'Latte', price: 55, category: 'coffee', image: 'https://images.unsplash.com/photo-1570968992272-1512fdad694d?w=400&q=80' },
                { id: 'hot_americano', name: 'Americano', price: 40, category: 'coffee', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80' },
                { id: 'hot_chai_latte', name: 'Chai Latte', price: 60, category: 'coffee', image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80' },
                { id: 'hot_dirty_chai', name: 'Dirty Chai', price: 75, category: 'coffee', image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80' },
                { id: 'hot_chocolate', name: 'Hot Chocolate', price: 50, category: 'coffee', image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80' },
                { id: 'hot_matcha_latte', name: 'Matcha Latte', price: 70, category: 'coffee', image: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80' },
                { id: 'hot_dirty_matcha', name: 'Dirty Matcha', price: 85, category: 'coffee', image: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80' },
                { id: 'hot_mocha', name: 'Mocha', price: 65, category: 'coffee', image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80' },
                { id: 'cold_caramel_iced', name: 'Caramel Iced Coffee', price: 60, category: 'drinks', image: 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80' },
                { id: 'cold_french_vanilla', name: 'French Vanilla Chai', price: 65, category: 'drinks', image: 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80' },
                { id: 'cold_iced_matcha', name: 'Iced Matcha', price: 70, category: 'drinks', image: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=400&q=80' },
                { id: 'cold_supreme_frappe', name: 'Supreme Frappe', price: 80, category: 'drinks', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80' },
                { id: 'cold_fresa_frappe', name: 'Fresa Frappe', price: 75, category: 'drinks', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80' },
                { id: 'cold_coffee_frappe', name: 'Coffee Frappe', price: 70, category: 'drinks', image: 'https://images.unsplash.com/photo-1517701604599-bb29b5c7fa69?w=400&q=80' },
                { id: 'cold_magoneada', name: 'Magoneada', price: 65, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'cold_mango_granita', name: 'Mango Granita', price: 55, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'cold_lemonade_granita', name: 'Lemonade Granita', price: 55, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'cold_fresa_granita', name: 'Fresa Granita', price: 55, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'cold_licuado', name: 'Licuado', price: 60, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'cold_niahs_licuadito', name: 'Niahs Licuadito', price: 50, category: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80' },
                { id: 'food_chicken_hummus', name: 'Chicken Salad Bowl', price: 140, category: 'food', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80' },
                { id: 'food_bean_rice', name: 'Bean & Rice Bowl', price: 120, category: 'food', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80' },
                { id: 'food_acai_bowl', name: 'Açaí Bowl', price: 125, category: 'food', image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80' },
                { id: 'food_acai_cup', name: 'Açaí Cup', price: 85, category: 'food', image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80' },
                { id: 'food_burgers_fries', name: 'Burgers and Fries', price: 150, category: 'food', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
                { id: 'food_sourdough_ham', name: 'Sourdough Ham/Turkey', price: 110, category: 'food', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
                { id: 'food_grill_cheese', name: 'Grill Cheese', price: 80, category: 'food', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' }
            ];
        }
        
        renderMenu();
        checkInventoryUpsell();
        simulateWhatsAppTraffic();
    };"""

content = re.sub(r'const menu = \[.*?\];', menu_str, content, flags=re.DOTALL)
content = content.replace('window.onload = () => {', '// window.onload replaced')
content = content.replace('onclick="openModifier(${item.id})"', 'onclick="openModifier(\'${item.id}\')"')
content = content.replace("if (typeof itemOrId === 'number') {", "if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {")

with open('public/pos-v2.html', 'w') as f:
    f.write(content)
