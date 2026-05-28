const fetch = require('node-fetch');

const BASE_URL = 'https://www.richaromacoffee.com';

async function testAuth() {
    console.log("--- 🧪 TESTING AUTH ---");
    
    try {
        console.log("Testing /api/cash/current-shift with Bearer EMP-admin...");
        const res = await fetch(`${BASE_URL}/api/cash/current-shift`, {
            headers: { 'Authorization': 'Bearer EMP-admin' }
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
    } catch (e) { console.error("Error:", e.message); }
}

testAuth();
