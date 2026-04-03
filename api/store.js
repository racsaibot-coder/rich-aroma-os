const { supabase } = require('./lib/supabase');

// VIP LOGIC HELPERS
const VIP_MONTHLY_RELOAD = 500.00;
const HONDURAS_TZ = 'America/Tegucigalpa';

function getHondurasDate() {
    try {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: HONDURAS_TZ, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());
    } catch(e) {
        return new Date().toISOString().split('T')[0];
    }
}

async function syncMembershipState(customer) {
    if (!customer) return customer;
    const isVip = customer.is_vip === true || (Array.isArray(customer.tags) && customer.tags.includes('VIP'));
    if (!isVip) return customer;

    const today = getHondurasDate();
    if (customer.next_renewal_date && today >= customer.next_renewal_date) {
        const breakage = parseFloat(customer.rico_balance) || 0;
        try {
            await supabase.from('membership_billing_events').insert({
                customer_id: customer.id,
                event_type: 'renewal_sweep',
                amount_swept: breakage,
                amount_deposited: VIP_MONTHLY_RELOAD
            });
        } catch (e) { console.error("[VIP] Billing log failed", e.message); }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        
        const { data } = await supabase.from('customers').update({
            rico_balance: VIP_MONTHLY_RELOAD,
            next_renewal_date: nextDate.toISOString().split('T')[0]
        }).eq('id', customer.id).select().single();
        if (data) return data;
    }
    return customer;
}

function applyVipBenefits(orderItems, customer, paymentMethod) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;
    const isVip = customer.is_vip === true || (Array.isArray(customer.tags) && customer.tags.includes('VIP'));
    const canClaimFreeDrink = isVip && (customer.last_free_drink_date !== today);

    const processedItems = (orderItems || []).map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && item.is_vip_free_eligible) {
            appliedDiscount = finalPrice;
            finalPrice = 0;
            freeDrinkClaimedThisOrder = true;
            item.is_free_benefit = true;
        }
        if (isVip && paymentMethod === 'rico_balance' && item.is_house_made && finalPrice > 0) {
            const discount = finalPrice * 0.10;
            finalPrice -= discount;
            appliedDiscount += discount;
        }
        return { 
            ...item, 
            finalPrice: parseFloat(finalPrice.toFixed(2)), 
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)) 
        };
    });

    return { 
        items: processedItems, 
        total: parseFloat(processedItems.reduce((s,i) => s + (i.finalPrice * i.qty), 0).toFixed(2)), 
        freeDrinkClaimed: freeDrinkClaimedThisOrder 
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query; 

    try {
        // STORE STATUS
        if (action === 'store_status' && req.method === 'GET') {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'store_is_open').single();
            if (error) return res.json({ isOpen: true });
            return res.json({ isOpen: data?.value?.isOpen ?? true });
        }

        // CUSTOMER LOGIN
        if (action === 'customer_login' && req.method === 'POST') {
            const { phone, pin } = req.body;
            if (!phone || !pin) return res.status(400).json({ error: "Teléfono y PIN requeridos" });
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const { data: customer, error } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single();
            if (error || !customer) return res.status(404).json({ error: "Usuario no encontrado" });
            if (customer.pin && customer.pin !== pin) return res.status(401).json({ error: "PIN incorrecto" });
            const synced = await syncMembershipState(customer);
            return res.json({ message: "Login successful", customer: synced });
        }

        // MENU (Bulletproof version)
        if (action === 'menu' && req.method === 'GET') {
            const isAdmin = req.query.admin === 'true';
            
            const [rItems, rModGroups, rModOptions, rItemModGroups] = await Promise.all([
                supabase.from('menu_items').select('*').order('name'),
                supabase.from('modifier_groups').select('*').order('display_order'),
                supabase.from('modifier_options').select('*').order('name'),
                supabase.from('item_modifier_groups').select('*')
            ]);

            const filteredItems = (rItems.data || []).filter(i => isAdmin || i.available !== false);

            const categoryMeta = {
                Combos: { name: 'Combos', icon: '🔥' },
                Calientes: { name: 'Calientes', icon: '☕' },
                Heladas: { name: 'Heladas', icon: '🥤' },
                Comida: { name: 'Comida', icon: '🥐' }
            };

            const grouped = {};
            filteredItems.forEach(item => {
                const cat = item.category || 'Otros';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push({
                    id: item.id,
                    name: item.name,
                    price: parseFloat(item.price) || 0,
                    available: item.available,
                    image_url: item.image_url,
                    category: cat
                });
            });

            const categories = Object.keys(grouped).map(catId => ({
                id: catId,
                name: categoryMeta[catId]?.name || catId,
                icon: categoryMeta[catId]?.icon || '📦',
                items: grouped[catId]
            }));

            return res.json({ 
                items: filteredItems, 
                categories,
                modGroups: rModGroups.data || [], 
                modOptions: rModOptions.data || [], 
                itemModGroups: rItemModGroups.data || [],
                taxRate: 0.00 
            });
        }

        // ORDERS
        if (action === 'orders' && req.method === 'POST') {
            const { items, subtotal, total, customerId, paymentMethod, notes } = req.body;
            
            let customer = null;
            if (customerId) {
                const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
                if (data) customer = await syncMembershipState(data);
            }

            const itemIds = (items || []).map(i => i.id);
            const { data: menuItems } = await supabase.from('menu_items').select('*').in('id', itemIds);
            
            const itemsWithMeta = (items || []).map(item => {
                const meta = (menuItems || []).find(m => m.id === item.id);
                return {
                    ...item,
                    is_house_made: meta?.is_house_made || false,
                    is_vip_free_eligible: meta?.is_vip_free_eligible || false
                };
            });

            let finalOrder = { items: itemsWithMeta, total: parseFloat(total) || 0, discount: 0 };

            if (customer) {
                const calculation = applyVipBenefits(itemsWithMeta, customer, paymentMethod);
                finalOrder = calculation;
                if (calculation.freeDrinkClaimed) {
                    await supabase.from('customers').update({ last_free_drink_date: getHondurasDate() }).eq('id', customer.id);
                }
            }

            const { data: maxOrder } = await supabase.from('orders').select('order_number').order('order_number', { ascending: false }).limit(1);
            const orderNum = (maxOrder?.[0]?.order_number || 0) + 1;

            const orderData = {
                id: `ORD-${Date.now()}`,
                order_number: orderNum,
                items: finalOrder.items,
                subtotal: parseFloat(subtotal) || 0,
                discount: finalOrder.discount || 0,
                total: finalOrder.total,
                status: 'pending',
                payment_method: paymentMethod,
                customer_id: customerId,
                notes: notes
            };

            if (paymentMethod === 'rico_balance' && customer) {
                const balance = parseFloat(customer.rico_balance) || 0;
                if (balance >= orderData.total) {
                    orderData.status = 'paid';
                    await supabase.from('customers').update({ rico_balance: balance - orderData.total }).eq('id', customer.id);
                } else return res.status(400).json({ error: "Saldo insuficiente" });
            }

            const { data, error } = await supabase.from('orders').insert(orderData).select().single();
            if (error) throw error;
            return res.json(data);
        }

        return res.status(404).json({ error: 'Action not found' });

    } catch (e) {
        console.error("Store API Error:", e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
};
