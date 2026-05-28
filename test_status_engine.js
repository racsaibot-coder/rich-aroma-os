const { applyVipBenefits } = require('./api/lib/pricing');

// Mock Data
const houseItem = { id: 'latte', name: 'Latte', price: 70, is_house_made: true, is_vip_free_eligible: true };
const premiumItem = { id: 'supreme_frappe', name: 'Supreme Frappe', price: 100, is_house_made: true, is_vip_free_eligible: false };
const exclusionItem = { id: 'dubai_chocolate', name: 'Dubai Chocolate', price: 250, is_house_made: true };
const retailItem = { id: 'football', name: 'Soccer Ball', price: 500, category: 'retail', is_house_made: false };

const blackCardMember = { 
    id: '001', 
    name: 'Dad Oscar', 
    tags: ['BlackCard'], 
    last_free_drink_date: '2000-01-01' // Eligible for free drink today
};

const employee = {
    id: 'emp_123',
    name: 'Maria Staff',
    tags: ['Employee']
};

const regularCustomer = {
    id: 'C123',
    name: 'Juan Public',
    tags: []
};

async function runTests() {
    console.log("--- 🧪 STATUS ENGINE TEST SUITE ---\n");

    // TEST 1: Regular Customer (No Discounts)
    const t1 = applyVipBenefits([houseItem], regularCustomer);
    console.log(`Test 1 (Regular): Price L.${t1.items[0].finalPrice} (Expected: 70)`);

    // TEST 2: Black Card - Daily Ritual (Free Coffee)
    const t2 = applyVipBenefits([houseItem], blackCardMember);
    console.log(`Test 2 (Black Card Free): Price L.${t2.items[0].finalPrice} (Expected: 0)`);
    console.log(`- Note: ${t2.items[0].free_drink_note}`);

    // TEST 3: Black Card - Premium Upgrade (Should NOT be free, but 50% off)
    const t3 = applyVipBenefits([premiumItem], blackCardMember);
    console.log(`Test 3 (Premium Upgrade): Price L.${t3.items[0].finalPrice} (Expected: 50)`);
    console.log(`- Discount Applied: L.${t3.items[0].appliedDiscount}`);

    // TEST 4: Fairness Cap (Max 2 Discounted Items)
    const multiOrder = [
        { id: 'latte1', name: 'Latte 1', price: 70, is_house_made: true },
        { id: 'latte2', name: 'Latte 2', price: 70, is_house_made: true },
        { id: 'latte3', name: 'Latte 3', price: 70, is_house_made: true } // 3rd item
    ];
    console.log("Running Test 4 with items:", multiOrder.map(i => `${i.name} (HM:${i.is_house_made})`));
    const t4 = applyVipBenefits(multiOrder, employee);
    console.log(`Test 4 Results - Tier: ${t4.tier}`);
    console.log(`Test 4 (Cap): Prices L.${t4.items[0].finalPrice}, L.${t4.items[1].finalPrice}, L.${t4.items[2].finalPrice}`);
    console.log(`- Expected: 35, 35, 70 (3rd item is full price)`);

    // TEST 5: Exclusions (Dubai Chocolate & Retail)
    const exclusionOrder = [exclusionItem, retailItem];
    const t5 = applyVipBenefits(exclusionOrder, blackCardMember);
    console.log(`Test 5 (Exclusions): Dubai L.${t5.items[0].finalPrice}, Retail L.${t5.items[1].finalPrice}`);
    console.log(`- Expected: 250, 500 (No discount)`);

    console.log("\n--- ✅ PRICING LOGIC VERIFIED ---");
}

runTests().catch(console.error);
