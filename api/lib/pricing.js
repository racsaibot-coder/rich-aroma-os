const { getHondurasDate } = require('./loyalty');

/**
 * Applies VIP / Black Card benefits to order items
 */
function applyVipBenefits(orderItems, customer) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;

    // --- IDENTITY DETECTION ---
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    
    // Black Card / Diamond (5 Slots)
    const isBlackCard = tags.includes('BlackCard') || tags.includes('Diamond');
    
    // Gold Card (15 Slots)
    const isGoldCard = tags.includes('GoldCard');

    // Familia (Extended Family - Gifted Status)
    const isFamilia = tags.includes('Familia');
    
    // Silver Card (20 Slots)
    const isSilverCard = tags.includes('SilverCard');

    // Employee
    const isEmployee = tags.includes('Employee');

    // Logic Assignment
    const hasFiftyPower = isBlackCard || isEmployee;
    const hasThirtyPower = isGoldCard;
    const hasTwentyPower = isFamilia;
    const hasFifteenPower = isSilverCard || (customer.is_vip === true || tags.includes('VIP'));

    // Black and Gold get the Ritual (Free Daily Coffee)
    const canClaimFreeDrink = (isBlackCard || isGoldCard || tags.includes('VIP')) && (customer.last_free_drink_date !== today);

    // --- STATUS ENGINE: UNCAPPED POWER ---
    // Diamond and Gold members can now buy for their whole group/car. 
    // We removed the 2-item cap to maximize the "Status/Bad Ass" feeling.

    const processedItems = orderItems.map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        const itemId = (item.id || '').toLowerCase();
        const itemCat = (item.category || '').toLowerCase();

        // EXCLUSIONS: Retail, Deportes, Dubai Chocolate (Protect Margins)
        const isExclusion = itemId.includes('dubai_chocolate') || itemCat.includes('retail') || itemCat.includes('deporte');
        const isHouseMade = item.is_house_made || !isExclusion;

        if (isExclusion) return { ...item, finalPrice, appliedDiscount: 0, qty: item.qty || 1 };

        // RULE 1: Daily Drink Ritual (FREE)
        const isStandardCoffee = itemId.includes('americano') || itemId.includes('latte') || itemId.includes('cappuccino') || (itemId.includes('iced_coffee') && !itemId.includes('frappe'));
        
        let isRitual = false;
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && isStandardCoffee) {
            appliedDiscount = finalPrice;
            finalPrice = 0;
            freeDrinkClaimedThisOrder = true;
            isRitual = true;
        }

        // RULE 2: Status Engine Power
        if (!isRitual && isHouseMade && finalPrice > 0) {
            if (hasFiftyPower) {
                const discount = finalPrice * 0.50;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.status_discount_applied = true;
            } else if (hasThirtyPower) {
                const discount = finalPrice * 0.30;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.status_discount_applied = true;
            } else if (hasTwentyPower) {
                // RULE: Familia (20% OFF Everything)
                const discount = finalPrice * 0.20;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.status_discount_applied = true;
            } else if (hasFifteenPower) {
                // RULE 3: Regular / Silver (15% OFF)
                const discount = finalPrice * 0.15;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.regular_discount_applied = true;
            }
        }

        return {
            ...item,
            finalPrice: parseFloat(finalPrice.toFixed(2)),
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)),
            qty: item.qty || 1,
            is_free_benefit: isRitual,
            tier_label: isBlackCard ? 'Diamond' : (isGoldCard ? 'Gold' : (isFamilia ? 'Familia' : (isSilverCard ? 'Silver' : 'Basic')))
        };
    });

    const finalTotal = processedItems.reduce((sum, i) => sum + (i.finalPrice * (i.qty || 1)), 0);

    return {
        items: processedItems,
        total: parseFloat(finalTotal.toFixed(2)),
        freeDrinkClaimed: freeDrinkClaimedThisOrder,
        tier: isBlackCard ? 'Diamond' : (isGoldCard ? 'Gold' : (isFamilia ? 'Familia' : (isSilverCard ? 'Silver' : 'Basic')))
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
