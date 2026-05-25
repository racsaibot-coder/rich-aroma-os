const { supabase: defaultSupabase } = require('./supabase');

/**
 * Deducts ingredients from inventory based on order items and modifiers.
 */
async function deductInventoryForOrder(orderItems, supabase = defaultSupabase) {
    if (!orderItems || !Array.isArray(orderItems)) return;

    try {
        const itemIds = orderItems.map(i => i.id);
        const allMods = [];
        orderItems.forEach(i => { if (i.mods && Array.isArray(i.mods)) allMods.push(...i.mods); });
        const modIds = allMods.map(m => typeof m === 'object' ? m.id : m).filter(Boolean);

        // Fetch all ingredients in parallel
        const [itemIngsRes, modIngsRes] = await Promise.all([
            supabase.from('menu_item_ingredients').select('*').in('menu_item_id', itemIds),
            supabase.from('modifier_ingredients').select('*').in('modifier_id', modIds)
        ]);

        const allDecrements = [];

        // 1. Process Menu Items
        for (const item of orderItems) {
            const ings = (itemIngsRes.data || []).filter(i => i.menu_item_id === item.id);
            for (const ing of ings) {
                const amountToDeduct = (parseFloat(ing.quantity) || 0) * (item.qty || 1);
                allDecrements.push(supabase.rpc('decrement_inventory', { 
                    item_id: ing.inventory_item_id, 
                    amount: amountToDeduct 
                }));
            }

            // 2. Process Modifiers for this item
            if (item.mods && Array.isArray(item.mods)) {
                for (const mod of item.mods) {
                    const modId = typeof mod === 'object' ? mod.id : mod;
                    const mIngs = (modIngsRes.data || []).filter(i => i.modifier_id === modId);
                    for (const mIng of mIngs) {
                        const amountToDeduct = (parseFloat(mIng.quantity) || 0) * (item.qty || 1);
                        allDecrements.push(supabase.rpc('decrement_inventory', { 
                            item_id: mIng.inventory_item_id, 
                            amount: amountToDeduct 
                        }));
                    }
                }
            }
        }

        // Execute all decrements in parallel
        if (allDecrements.length > 0) {
            console.log(`[Inventory] Firing ${allDecrements.length} decrements...`);
            await Promise.all(allDecrements);
            return true;
        }
    } catch (e) {
        console.error("[Inventory] Deduction engine failed:", e);
        return false;
    }
}

module.exports = {
    deductInventoryForOrder
};
