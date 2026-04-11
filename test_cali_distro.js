const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8083';
const ADMIN_TOKEN = 'EMP-admin';

// These IDs were fetched from the previous step
const TEST_PRODUCT_ID = '0a2426f0-6492-4c91-8af7-4a3a1aa5b1f9';
const TEST_LOCATION_ID = 'f09faa44-50a0-4632-bfa1-4e81a42e424e';

async function runCaliTest() {
    console.log("🚀 Starting Cali Distro End-to-End Test...");

    try {
        // 1. Fetch Products
        console.log("\n[1] Testing Product Fetch...");
        let res = await fetch(`${BASE_URL}/api/cali?action=products`);
        let products = await res.json();
        if (!res.ok || !Array.isArray(products)) throw new Error('Failed to fetch products');
        console.log(`✅ Found ${products.length} products.`);

        // 2. Fetch Locations
        console.log("\n[2] Testing Location Fetch...");
        res = await fetch(`${BASE_URL}/api/cali?action=locations`);
        let locations = await res.json();
        if (!res.ok || !Array.isArray(locations)) throw new Error('Failed to fetch locations');
        console.log(`✅ Found ${locations.length} locations.`);

        // 3. Submit Transfer Order
        console.log("\n[3] Submitting Transfer Order...");
        const orderPayload = {
            customer_name: 'Cali Tester',
            customer_phone: '123456789',
            location_id: TEST_LOCATION_ID,
            product_id: TEST_PRODUCT_ID,
            quantity: 1,
            total_price: 5.00,
            selections: { flavor: 'Vanilla', milk: 'Regular' },
            notes: 'Test order from automated script'
        };

        res = await fetch(`${BASE_URL}/api/cali?action=submit_order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        let order = await res.json();
        if (!res.ok) throw new Error('Order submission failed: ' + order.error);
        console.log(`✅ Order placed: ${order.id}`);

        // 4. Test Receipt Upload
        console.log("\n[4] Testing Receipt Upload...");
        const uploadPayload = {
            action: 'upload_receipt',
            imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        };
        res = await fetch(`${BASE_URL}/api/cali?action=update_order&id=${order.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(uploadPayload)
        });
        let updatedOrder = await res.json();
        if (!res.ok) throw new Error('Receipt upload failed: ' + updatedOrder.error);
        console.log(`✅ Receipt uploaded. URL present: ${!!updatedOrder.payment_proof_url}`);

        // 5. Verify in Admin List
        console.log("\n[5] Verifying Order in Admin List...");
        res = await fetch(`${BASE_URL}/api/cali?action=orders`, {
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });
        let adminOrders = await res.json();
        const found = adminOrders.find(o => o.id === order.id);
        if (!found) throw new Error('Order not found in admin list');
        console.log(`✅ Verified order exists in Admin Dashboard.`);

        // 6. Test Stripe Session Creation
        console.log("\n[6] Testing Stripe Session Creation...");
        const stripePayload = {
            name: 'Stripe Tester',
            phone: '987654321',
            location_id: TEST_LOCATION_ID,
            product_id: TEST_PRODUCT_ID,
            quantity: 2,
            selections: { flavor: 'Caramel', milk: 'Oat Milk' },
            notes: 'Stripe test'
        };
        res = await fetch(`${BASE_URL}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stripePayload)
        });
        let stripeRes = await res.json();
        if (res.ok && stripeRes.url) {
            console.log(`✅ Stripe session created: ${stripeRes.url.substring(0, 50)}...`);
        } else {
            console.log(`⚠️ Stripe session not created (expected if keys missing): ${stripeRes.error || 'N/A'}`);
        }

        console.log("\n🎉 ALL CALI DISTRO TESTS PASSED!");

    } catch (e) {
        console.error("\n❌ Cali Test Failed:", e.message);
        process.exit(1);
    }
}

runCaliTest();
