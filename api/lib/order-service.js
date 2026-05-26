const { supabase: defaultSupabase } = require('./supabase');
const { awardPoints, syncMembershipState, getHondurasDate } = require('./loyalty');
const { applyVipBenefits, applyBootcampBenefits, calculateSurgeDiscounts } = require('./pricing');
const { deductInventoryForOrder } = require('./inventory-service');
const { notifyOrder } = require('./email-service');

/**
 * Main Order Orchestrator for Rich Aroma OS & QuimiEats
 */
async function createOrder(orderRequest, supabase = defaultSupabase) {
    const { 
        items, 
        paymentMethod, 
        secondaryPaymentMethod,
        ricoAmount,
        customerId, 
        customerPhone, 
        customerName,
        notes, 
        fulfillment, 
        restaurantId,
        isPos = false,
        shiftId,
        guestPhone,
        scheduledFor, // New Parameter
        category // New Parameter for restaurant
    } = orderRequest;

    const targetResId = restaurantId || 'rich-aroma';
    const cleanPhone = (customerPhone || guestPhone || '').replace(/\D/g, '');

    try {
        // --- 0. MULTI-TENANT SAFEGUARD ---
        const { data: checkRes } = await supabase.from('restaurants').select('id').eq('id', targetResId).maybeSingle();
        if (!checkRes) {
            console.log(`[OrderService] Auto-creating missing restaurant: ${targetResId}`);
            const { error: insErr } = await supabase.from('restaurants').insert({
                id: targetResId,
                name: targetResId.replace(/-/g, ' ').toUpperCase(),
                status: 'active',
                category: category || 'restaurante', // Use the new category
                settings: { auto_created: true }
            });
            if (insErr) console.error(`[OrderService] Failed to create restaurant: ${insErr.message}`);
        } else if (category && !checkRes.category) {
            // Update category if it was missing
            await supabase.from('restaurants').update({ category }).eq('id', targetResId);
        }

        // 1. Identify/Sync Customer
        let customer = null;
        let finalCustomerId = customerId;

        if (!finalCustomerId && cleanPhone) {
            const { data: existing } = await supabase.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
            if (existing) {
                finalCustomerId = existing.id;
            } else {
                // Auto-create guest
                const { data: newCust } = await supabase.from('customers').insert({
                    id: 'cust_' + Date.now(),
                    phone: cleanPhone,
                    name: customerName || 'Invitado',
                    points: 0
                }).select().single();
                if (newCust) finalCustomerId = newCust.id;
            }
        }

        if (finalCustomerId) {
            const { data } = await supabase.from('customers').select('*').eq('id', finalCustomerId).single();
            if (data) {
                customer = await syncMembershipState(data, supabase);
            }
        }

        // 2. Pricing & Meta Logic
        const itemIds = (items || []).map(i => i.id);
        const { data: menuItems } = await supabase.from('menu_items').select('id, category, is_house_made, is_vip_free_eligible').in('id', itemIds);
        
        const itemsWithMeta = (items || []).map(item => {
            const meta = (menuItems || []).find(m => m.id === item.id);
            return {
                ...item,
                category: meta?.category || 'General',
                is_house_made: meta?.is_house_made || false,
                is_vip_free_eligible: meta?.is_vip_free_eligible || false
            };
        });

        // Surge Engine (Rich Aroma Only for now)
        let surgeDiscount = 0;
        if (targetResId === 'rich-aroma') {
            const { data: activeSurges } = await supabase.from('surge_deals')
                .select('*')
                .eq('active', true)
                .gt('expires_at', new Date().toISOString());
            surgeDiscount = calculateSurgeDiscounts(itemsWithMeta, activeSurges || []);
        }

        // VIP Engine
        let finalOrderData = {
            items: itemsWithMeta,
            subtotal: itemsWithMeta.reduce((sum, i) => sum + (parseFloat(i.price) * (i.qty || 1)), 0),
            total: itemsWithMeta.reduce((sum, i) => sum + (parseFloat(i.price) * (i.qty || 1)), 0) - surgeDiscount,
            discount: surgeDiscount
        };

        let freeDrinkClaimed = false;
        if (customer && (customer.is_vip || (customer.tags && customer.tags.includes('VIP')))) {
            const vipCalc = applyVipBenefits(itemsWithMeta, customer);
            finalOrderData.items = vipCalc.items;
            finalOrderData.total = vipCalc.total - surgeDiscount;
            finalOrderData.discount += vipCalc.items.reduce((sum, i) => sum + (i.appliedDiscount || 0), 0);
            freeDrinkClaimed = vipCalc.freeDrinkClaimed;
            
            if (freeDrinkClaimed) {
                await supabase.from('customers').update({ last_free_drink_date: getHondurasDate() }).eq('id', customer.id);
            }
        } else if (customer && customer.tags && customer.tags.includes('Bootcamp')) {
            const bootCalc = applyBootcampBenefits(itemsWithMeta, customer);
            finalOrderData.items = bootCalc.items;
            finalOrderData.total = bootCalc.total - surgeDiscount;
            finalOrderData.discount += bootCalc.items.reduce((sum, i) => sum + (i.appliedDiscount || 0), 0);
        }

        // 3. Rico Balance Logic
        let orderStatus = 'pending';
        if (paymentMethod === 'rico_balance' && customer) {
            const currentBalance = parseFloat(customer.rico_balance) || 0;
            if (currentBalance >= finalOrderData.total) {
                orderStatus = 'paid';
                await supabase.from('customers').update({ rico_balance: currentBalance - finalOrderData.total }).eq('id', customer.id);
                await supabase.from('balance_history').insert({
                    customer_id: customer.id,
                    type: 'payment',
                    amount: -finalOrderData.total,
                    notes: `Order #${finalOrderData.total}`
                });
            } else {
                throw new Error('Saldo insuficiente en Rico Cash');
            }
        }

        // 4. Create Order
        const orderNum = Math.floor(Date.now() / 1000) - 1769000000;
        const orderId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        const dbOrder = {
            id: orderId,
            order_number: orderNum,
            items: finalOrderData.items,
            subtotal: finalOrderData.subtotal,
            total: finalOrderData.total,
            discount: finalOrderData.discount,
            tax: 0,
            status: orderStatus,
            payment_method: paymentMethod,
            secondary_payment_method: secondaryPaymentMethod,
            rico_amount_paid: ricoAmount || 0,
            customer_id: finalCustomerId,
            restaurant_id: targetResId,
            shift_id: shiftId,
            scheduled_for: scheduledFor,
            notes: `[FULFILLMENT: ${fulfillment || 'pickup'}] ` + (guestPhone ? `[TEL: ${guestPhone}] ` : '') + (notes || '')
        };

        // QuimiEats Commission Note
        if (!isPos && targetResId !== 'rich-aroma') {
            const commission = parseFloat(dbOrder.total) * 0.10;
            const ledgerNote = `[LEDGER: type=commission, amount=-${commission.toFixed(2)}, status=pending]`;
            dbOrder.notes = (dbOrder.notes || '') + " " + ledgerNote;
        }

        const { data, error } = await supabase.from('orders').insert(dbOrder).select().single();
        if (error) throw error;

        // 5. Post-Order Background Tasks
        (async () => {
            // Loyalty Points
            if (finalCustomerId) {
                await awardPoints(finalCustomerId, dbOrder.total, paymentMethod, supabase);
            }
            // Inventory (Rich Aroma Only)
            if (targetResId === 'rich-aroma') {
                await deductInventoryForOrder(dbOrder.items, supabase);
            }
            // Email Notification (Every order triggers an email)
            await notifyOrder(data);
        })();

        return data;

    } catch (e) {
        console.error("[OrderService] Order Creation Failed:", e);
        throw e;
    }
}

module.exports = {
    createOrder
};
