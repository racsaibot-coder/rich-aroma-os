const { getHondurasDate } = require('./loyalty');

/**
 * Applies VIP / Black Card benefits to order items
 */
function applyVipBenefits(orderItems, customer) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;

    // 1. IDENTITY DETECTION
    const now = new Date();
    const expiry = customer.vip_expiry ? new Date(customer.vip_expiry) : null;
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    
    // Employee: Lifetime discount as long as they are staff
    const isEmployee = tags.includes('Employee');
    
    // Black Card: 50% Power Member (Paid monthly)
    const isBlackCard = tags.includes('BlackCard') && (!expiry || expiry > now);
    
    // Legacy VIP: Standard benefits
    const isLegacyVip = (customer.is_vip === true || tags.includes('VIP')) && (!expiry || expiry > now);

    // Rule: Employee and Black Card get the "Status Engine" 50% power
    const hasFiftyPercentPower = isEmployee || isBlackCard;

    // Check daily eligibility for free drink (Black Card or Legacy VIP)
    // NOTE: Black Card gets the ritual too
    const canClaimFreeDrink = (isBlackCard || isLegacyVip) && (customer.last_free_drink_date !== today);

    // Fairness Cap
    const MAX_DISCOUNTED_ITEMS = 2;
    let discountedItemCount = 0;

    const processedItems = orderItems.map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        const itemId = (item.id || '').toLowerCase();

        // RULE 1: Daily Drink Validation (Free)
        const isStandardCoffee = itemId.includes('americano') || itemId.includes('latte') || itemId.includes('cappuccino') || (itemId.includes('iced_coffee') && !itemId.includes('frappe'));
        
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && isStandardCoffee) {
            appliedDiscount = finalPrice;
            finalPrice = 0;
            freeDrinkClaimedThisOrder = true;
            item.is_free_benefit = true;
            item.free_drink_note = "Ritual Diario";
        }

        // RULE 2: Status Engine 50% Power
        const isExclusion = itemId.includes('dubai_chocolate') || (item.category || '').toLowerCase().includes('retail');
        
        if (hasFiftyPercentPower && !item.is_free_benefit && item.is_house_made && !isExclusion && finalPrice > 0) {
            // console.log(`[Pricing] Power active for ${item.name}. Count: ${discountedItemCount}/${MAX_DISCOUNTED_ITEMS}`);
            if (discountedItemCount < MAX_DISCOUNTED_ITEMS) {
                const discount = finalPrice * 0.50;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.status_discount_applied = true;
                discountedItemCount += 1;
            } else {
                item.status_discount_capped = true;
            }
        }
        
        // Legacy 50% for VIPs who aren't BlackCard
        if (isLegacyVip && !hasFiftyPercentPower && !item.is_free_benefit && item.is_house_made && finalPrice > 0) {
            const discount = finalPrice * 0.50;
            finalPrice -= discount;
            appliedDiscount += discount;
        }

        return {
            ...item,
            finalPrice: parseFloat(finalPrice.toFixed(2)),
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)),
            qty: item.qty || 1,
            free_drink_note: item.free_drink_note
        };
    });

    const finalTotal = processedItems.reduce((sum, i) => sum + (i.finalPrice * (i.qty || 1)), 0);

    return {
        items: processedItems,
        total: parseFloat(finalTotal.toFixed(2)),
        freeDrinkClaimed: freeDrinkClaimedThisOrder,
        tier: isBlackCard ? 'BlackCard' : (isEmployee ? 'Employee' : (isLegacyVip ? 'VIP' : 'Basic'))
    };
}

/**
 * Applies Bootcamp Member discounts (20% off during workout hours)
 */
function applyBootcampBenefits(orderItems, customer) {
    const isBootcamp = Array.isArray(customer.tags) && customer.tags.includes('Bootcamp');
    if (!isBootcamp) return { items: orderItems, total: orderItems.reduce((s, i) => s + (parseFloat(i.price) * (i.qty || 1)), 0) };

    const now = new Date();
    // Convert to Honduras hour
    const hour = (now.getUTCHours() - 6 + 24) % 24;
    
    // Rule: Discount valid during workout blocks (5am-8am or 6pm-10pm)
    const isWorkoutHour = (hour >= 5 && hour < 8) || (hour >= 18 && hour < 22);

    const processedItems = orderItems.map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        const cat = (item.category || '').toLowerCase();

        // 20% Discount on Coffee and Healthy Drinks (Frío/Heladas)
        if (isWorkoutHour && (cat.includes('coffee') || cat.includes('hot') || cat.includes('cold') || cat.includes('drink'))) {
            appliedDiscount = finalPrice * 0.20;
            finalPrice -= appliedDiscount;
        }

        return {
            ...item,
            finalPrice: parseFloat(finalPrice.toFixed(2)),
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)),
            qty: item.qty || 1
        };
    });

    const finalTotal = processedItems.reduce((sum, i) => sum + (i.finalPrice * i.qty), 0);

    return {
        items: processedItems,
        total: parseFloat(finalTotal.toFixed(2))
    };
}

/**
 * Calculates Surge Discounts
 */
function calculateSurgeDiscounts(items, activeSurges) {
    let surgeDiscount = 0;

    if (!activeSurges || activeSurges.length === 0) return 0;

    activeSurges.forEach(surge => {
        if (surge.type === '2x1_bakery') {
            const eligibleItems = items.filter(i => 
                (i.category || '').toLowerCase().includes('reposteria') || 
                (i.category || '').toLowerCase().includes('bakery')
            );
            let totalQty = eligibleItems.reduce((s, i) => s + (i.qty || 1), 0);
            let freeUnits = Math.floor(totalQty / 2);
            
            if (freeUnits > 0) {
                const sorted = [...eligibleItems].sort((a, b) => a.price - b.price);
                let remainingFree = freeUnits;
                for (const item of sorted) {
                    if (remainingFree <= 0) break;
                    const canTake = Math.min(item.qty || 1, remainingFree);
                    surgeDiscount += (parseFloat(item.price) * canTake);
                    remainingFree -= canTake;
                }
            }
        }
    });

    return parseFloat(surgeDiscount.toFixed(2));
}

module.exports = {
    applyVipBenefits,
    applyBootcampBenefits,
    calculateSurgeDiscounts
};
