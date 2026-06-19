const { getHondurasDate } = require('./loyalty');

/**
 * Applies VIP / Black Card benefits to order items
 */
function applyVipBenefits(orderItems, customer) {
    const today = getHondurasDate();
    let freeDrinkClaimedThisOrder = false;

    // --- IDENTITY DETECTION ---
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    
    // Special Tiers
    const isFounder = tags.includes('Founder'); // Mom & Dad
    const isHero = tags.includes('Hero'); // Cops/Firefighters
    const isFamilia = tags.includes('Familia'); // Extended Family
    const hasFoodBenefit = tags.includes('Benefit:Food'); // e.g. David

    // Main Legacy Tiers
    const isDiamond = tags.includes('Diamond'); // Elite (50%)
    const isGold = tags.includes('GoldCard'); // Pro (25%)
    const isSilver = tags.includes('SilverCard'); // Frequent (15%)
    const isBronze = tags.includes('BronzeCard'); // Member (10%)
    const isEmployee = tags.includes('Employee'); // Staff (50%)

    // Ritual Access (Free Daily Coffee)
    const canClaimFreeDrink = (isFounder || isDiamond || isGold || isEmployee) && (customer.last_free_drink_date !== today);

    const processedItems = orderItems.map(item => {
        let finalPrice = parseFloat(item.price) || 0;
        let appliedDiscount = 0;
        const itemId = (item.id || '').toLowerCase();
        const itemName = (item.name || '').toLowerCase();
        const itemCat = (item.category || '').toLowerCase();

        // EXCLUSIONS: Retail, Deportes, Dubai Chocolate (Protect Margins)
        const isExclusion = itemId.includes('dubai_chocolate') || itemCat.includes('retail') || itemCat.includes('deporte');
        const isHouseMade = item.is_house_made || !isExclusion;

        // RULE 0: STAFF SPECIALS (Sodas at L. 25)
        const isSoda = itemName.includes('soda') || itemName.includes('pepsi') || itemName.includes('coca') || itemCat.includes('soda');
        if (isEmployee && isSoda) {
            const staffSodaPrice = 25; // UPDATED to L. 25 per owner request
            if (finalPrice > staffSodaPrice) {
                appliedDiscount = (finalPrice - staffSodaPrice);
                finalPrice = staffSodaPrice;
            }
        }

        if (isExclusion && !isSoda) return { ...item, finalPrice, appliedDiscount: 0, qty: item.qty || 1 };

        // RULE 1: Daily Drink Ritual (FREE)
        const isStandardCoffee = itemId.includes('americano') || itemId.includes('latte') || itemId.includes('cappuccino') || (itemId.includes('iced_coffee') && !itemId.includes('frappe'));
        
        let isRitual = false;
        if (canClaimFreeDrink && !freeDrinkClaimedThisOrder && isStandardCoffee) {
            appliedDiscount = finalPrice;
            finalPrice = 0;
            freeDrinkClaimedThisOrder = true;
            isRitual = true;
        }

        // RULE 2: Status Engine Power (UNCAPPED)
        if (!isRitual && finalPrice > 0) {
            let discPct = 0;

            if (hasFoodBenefit && isHouseMade && itemCat.includes('food')) {
                // David's specialized 100% food benefit
                discPct = 1.0;
            } else if (isFounder || isDiamond || isEmployee || isHero) {
                // Founder, Diamond, Employee, Hero: 50% Off Homemade
                if (isHouseMade) discPct = 0.50;
            } else if (isGold) {
                // Gold: 25% Off Homemade
                if (isHouseMade) discPct = 0.25;
            } else if (isFamilia) {
                // Familia: 20% Off EVERYTHING
                discPct = 0.20;
            } else if (isSilver || customer.is_vip) {
                // Silver: 15% Off EVERYTHING
                discPct = 0.15;
            } else if (isBronze) {
                // Bronze: 10% Off EVERYTHING
                discPct = 0.10;
            }

            if (discPct > 0) {
                const discount = finalPrice * discPct;
                finalPrice -= discount;
                appliedDiscount += discount;
                item.status_discount_applied = true;
            }
        }

        let label = 'Basic';
        if (isFounder) label = 'Founder';
        else if (isDiamond) label = 'Diamond';
        else if (isGold) label = 'Gold';
        else if (isSilver) label = 'Silver';
        else if (isBronze) label = 'Bronze';
        else if (isFamilia) label = 'Familia';
        else if (isHero) label = 'Hero';

        return {
            ...item,
            finalPrice: parseFloat(finalPrice.toFixed(2)),
            appliedDiscount: parseFloat(appliedDiscount.toFixed(2)),
            qty: item.qty || 1,
            is_free_benefit: isRitual,
            tier_label: label
        };
    });

    const finalTotal = processedItems.reduce((sum, i) => sum + (i.finalPrice * (i.qty || 1)), 0);

    let tierLabel = 'Basic';
    if (isFounder) tierLabel = 'Founder';
    else if (isDiamond) tierLabel = 'Diamond';
    else if (isGold) tierLabel = 'Gold';
    else if (isSilver) tierLabel = 'Silver';
    else if (isBronze) tierLabel = 'Bronze';
    else if (isFamilia) tierLabel = 'Familia';
    else if (isHero) tierLabel = 'Hero';

    return {
        items: processedItems,
        total: parseFloat(finalTotal.toFixed(2)),
        freeDrinkClaimed: freeDrinkClaimedThisOrder,
        tier: tierLabel
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
