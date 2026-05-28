const fetch = require('node-fetch');

const BASE_URL = 'https://www.richaromacoffee.com';

async function testLogin() {
    console.log("--- 🧪 TESTING POS LOGIN ---");
    
    // 1. Test /api/cash/verify-pin (Used by POS)
    try {
        console.log("Testing /api/cash/verify-pin...");
        const res = await fetch(`${BASE_URL}/api/cash/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '4574' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 200) console.log("✅ POS Login OK");
        else console.log("❌ POS Login FAILED");
    } catch (e) { console.error("Error:", e.message); }

    // 2. Test /api/admin?action=staff_login (Used by Admin Panel)
    try {
        console.log("\nTesting /api/admin?action=staff_login...");
        const res = await fetch(`${BASE_URL}/api/admin?action=staff_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '4574' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 200) console.log("✅ Admin Login OK");
        else console.log("❌ Admin Login FAILED");
    } catch (e) { console.error("Error:", e.message); }
}

testLogin();
