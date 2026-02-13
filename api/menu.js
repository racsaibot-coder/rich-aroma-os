// api/menu.js
const { supabase } = require('./lib/supabase');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { data: items } = await supabase.from('menu_items').select('*').eq('available', true);
    const { data: modifiers } = await supabase.from('menu_modifiers').select('*');
    
    // Group items
    const grouped = {};
    (items || []).forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push({
            id: item.id,
            name: item.name,
            nameEs: item.name_es,
            price: parseFloat(item.price)
        });
    });
    
    const categories = Object.keys(grouped).map(catId => ({
        id: catId,
        name: catId.charAt(0).toUpperCase() + catId.slice(1),
        icon: '☕', // Simplified icon logic
        items: grouped[catId]
    }));
    
    const modifiersMap = {};
    (modifiers || []).forEach(m => {
        modifiersMap[m.id] = { name: m.name, price: parseFloat(m.price) };
    });
    
    res.json({ categories, modifiers: modifiersMap, taxRate: 0.15 });
}