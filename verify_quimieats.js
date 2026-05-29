const fetch = require('node-fetch');

const API_URL = 'https://www.richaromacoffee.com/api/admin?action=quimieats_active';
const MENU_URL = 'https://www.richaromacoffee.com/api/menu?id=fradas-bar--grill-445';

async function verify() {
    console.log("--- 🕵️ QUIMIEATS LIVE VERIFICATION ---\n");

    try {
        // 1. Verify Active List
        console.log("Step 1: Checking business whitelist...");
        const res = await fetch(API_URL);
        const businesses = await res.json();
        
        console.log(`Found ${businesses.length} businesses.`);
        businesses.forEach(b => console.log(`- ${b.name} (${b.id})`));

        if (businesses.length !== 4) {
            console.error("❌ FAILED: Expected exactly 4 businesses.");
        } else {
            console.log("✅ SUCCESS: Whitelist enforced.");
        }

        // 2. Verify Fradas Menu
        console.log("\nStep 2: Checking Fradas Menu connection...");
        const menuRes = await fetch(MENU_URL);
        const menuData = await menuRes.json();
        
        const categories = Object.keys(menuData.categories || {});
        console.log(`Found ${categories.length} menu categories for Fradas.`);

        if (categories.length > 0) {
            console.log("✅ SUCCESS: Fradas Menu is LIVE and linked.");
            console.log("Categories found:", categories.join(", "));
        } else {
            console.error("❌ FAILED: Fradas Menu returned empty.");
        }

    } catch (e) {
        console.error("Verification Error:", e.message);
    }
}

verify();
