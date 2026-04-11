const fetch = require('node-fetch');

const BASE_URL = 'https://www.richaromacoffee.com';
const ADMIN_TOKEN = 'Bearer EMP-admin';

async function runTest() {
    console.log("🚀 Starting MVP Stress Test...");

    try {
        // 1. Verify Login PIN
        console.log("\nStep 1: Verifying PIN...");
        const loginRes = await fetch(`${BASE_URL}/api/cash/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '1234' })
        });
        const loginData = await loginRes.json();
        console.log("Login Result:", loginRes.status, loginData.employee ? "✅" : "❌");

        // 2. Open Shift
        console.log("\nStep 2: Opening Shift...");
        const openRes = await fetch(`${BASE_URL}/api/cash/open-shift`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_TOKEN },
            body: JSON.stringify({ employeeId: 'E001', openingAmount: 500 })
        });
        const openData = await openRes.json();
        console.log("Open Shift Result:", openRes.status, openData.id ? "✅" : "❌");
        const shiftId = openData.id;

        // 3. Place Mobile Order (Cash)
        console.log("\nStep 3: Placing Mobile Order (Cash)...");
        const orderCashRes = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: 'food_baleadas', qty: 2, finalPrice: 35, name: 'Baleada', mods: [] }],
                total: 70,
                paymentMethod: 'cash',
                notes: 'Mobile Order Test'
            })
        });
        const orderCashData = await orderCashRes.json();
        console.log("Mobile Order (Cash) Result:", orderCashRes.status, orderCashData.id ? "✅" : "❌");

        // 4. Place Mobile Order (Transfer)
        console.log("\nStep 4: Placing Mobile Order (Transfer)...");
        const orderTransRes = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ id: 'hot_latte', qty: 1, finalPrice: 55, name: 'Latte', mods: [] }],
                total: 55,
                paymentMethod: 'transfer',
                notes: 'Transfer Test [RECEIPT_URL:https://example.com/receipt.jpg]'
            })
        });
        const orderTransData = await orderTransRes.json();
        console.log("Mobile Order (Transfer) Result:", orderTransRes.status, orderTransData.id ? "✅" : "❌");

        // 5. Close Shift
        if (shiftId) {
            console.log("\nStep 5: Closing Shift...");
            const closeRes = await fetch(`${BASE_URL}/api/cash/close-shift`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': ADMIN_TOKEN },
                body: JSON.stringify({ shiftId: shiftId, closingAmount: 570 }) // 500 base + 70 cash order
            });
            const closeData = await closeRes.json();
            console.log("Close Shift Result:", closeRes.status, closeData.report ? "✅" : "❌");
            if (closeData.report) console.log("Report Summary:", JSON.stringify(closeData.report, null, 2));
        }

        console.log("\n🌟 Stress Test Complete!");
    } catch (err) {
        console.error("❌ Test Failed:", err);
    }
}

runTest();
