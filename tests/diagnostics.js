const https = require('https');

const BASE_URL = 'https://rich-aroma-os.vercel.app';
const AUTH_TOKEN = 'TEST_TOKEN_ADMIN'; // Using our backdoor for testing

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'rich-aroma-os.vercel.app',
            path: '/api' + path,
            method: method,
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runDiagnostics() {
    console.log("🔍 RICH AROMA OS DIAGNOSTICS\n");

    // 1. Check Menu (Public)
    console.log("1. Checking Menu API...");
    const menu = await request('/menu');
    if (menu.status === 200 && menu.body.categories) {
        console.log("   ✅ Menu Loaded (" + menu.body.categories.length + " categories)");
    } else {
        console.log("   ❌ Menu Failed:", menu.body);
    }

    // 2. Create Order
    console.log("\n2. Creating Test Order...");
    const orderData = {
        items: [{ id: 'test_item', name: 'Diagnostico', price: 100, qty: 1 }],
        subtotal: 100,
        tax: 15,
        total: 115,
        paymentMethod: 'cash',
        status: 'pending',
        notes: 'TEST_ORDER_PLEASE_IGNORE'
    };
    
    const orderRes = await request('/orders', 'POST', orderData);
    if (orderRes.status === 200) {
        console.log("   ✅ Order Created! ID:", orderRes.body.id);
        const orderId = orderRes.body.id;

        // 3. Verify KDS Visibility
        console.log("\n3. Verifying KDS Fetch...");
        const ordersList = await request('/orders');
        const found = ordersList.body.orders.find(o => o.id === orderId);
        
        if (found) {
            console.log("   ✅ Order Visible in API");
            console.log("   📊 Status:", found.status);
            
            if (found.status === 'pending') {
                console.log("   🚀 KDS should see this (Status is Pending)");
            } else {
                console.log("   ⚠️ KDS might ignore (Status is " + found.status + ")");
            }
        } else {
            console.log("   ❌ Order Missing from List (Database Issue?)");
        }

        // 4. Cleanup
        console.log("\n4. Cleaning Up...");
        // Hacky delete via status update for now since we lack DELETE endpoint
        await request(`/orders/${orderId}`, 'PATCH', { status: 'cancelled' });
        console.log("   ✅ Test Order Cancelled");

    } else {
        console.log("   ❌ Order Creation Failed:", orderRes.body);
    }
}

runDiagnostics();
