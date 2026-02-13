
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// SIMULATION: The Opening Day Rush 🐆
// This script simulates 50 customers hitting the /join page and signing up.
// It will fire requests to your LIVE Vercel API.

// We need a unique simulation ID to avoid conflicts if re-running
const SIM_ID = Math.floor(Math.random() * 10000);

const TARGET_URL = 'https://rich-aroma-os.vercel.app/api/admin/founders/add';
const TOTAL_CUSTOMERS = 50;
const DELAY_MS = 200; // Fast but realistic (5 per second)

const NAMES = [
    "Maria Lopez", "Carlos Ruiz", "Ana Sofia", "Juan Perez", "Elena Cruz",
    "David M.", "Sofia G.", "Luis H.", "Carmen R.", "Pedro S.",
    "Lucia F.", "Miguel A.", "Isabela T.", "Jorge V.", "Valentina",
    "Diego R.", "Camila P.", "Mateo L.", "Valeria M.", "Sebastian",
    "Ximena C.", "Nicolas G.", "Victoria", "Samuel D.", "Martina",
    "Daniel F.", "Natalia R.", "Alejandro", "Daniela S.", "Gabriel",
    "Sara M.", "Benjamin", "Regina H.", "Lucas P.", "Renata",
    "Emilio T.", "Antonella", "Joaquin", "Allison G.", "Francisco",
    "Catalina", "Emmanuel", "Fernanda", "Leonardo", "Romina",
    "Santiago", "Paula V.", "Adrian L.", "Mariana Z.", "Julian"
];

async function runSimulation() {
    console.log(`🚀 STARTING OPENING DAY SIMULATION (ID: ${SIM_ID})...`);
    console.log(`🎯 Target: ${TARGET_URL}`);
    console.log(`👥 Customers: ${TOTAL_CUSTOMERS}`);
    console.log('------------------------------------------------');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < TOTAL_CUSTOMERS; i++) {
        const name = `${NAMES[i]} (Sim ${SIM_ID})`;
        const phone = `99${Math.floor(100000 + Math.random() * 900000)}`;
        
        // Randomly simulate some paying immediately vs pending
        const status = Math.random() > 0.8 ? 'confirmed' : 'pending'; 
        const ref = status === 'confirmed' ? `CASH-SIM-${SIM_ID}-${i}` : 'WEB_RESERVATION';

        try {
            const payload = {
                name,
                phone,
                ref,
                status
            };

            const start = Date.now();
            const res = await fetch(TARGET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const duration = Date.now() - start;

            if (res.ok) {
                const data = await res.json();
                successCount++;
                console.log(`✅ [${i+1}/${TOTAL_CUSTOMERS}] Signed up: ${name} (${data.entry.ticket}) - ${status.toUpperCase()} [${duration}ms]`);
            } else {
                // If 500, log body
                const text = await res.text();
                console.log(`❌ [${i+1}/${TOTAL_CUSTOMERS}] Failed: ${name} - Status ${res.status} - ${text.substring(0, 100)}`);
                failCount++;
            }

        } catch (e) {
            console.log(`❌ [${i+1}/${TOTAL_CUSTOMERS}] Error: ${name}`, e.message);
            failCount++;
        }

        // Wait a bit to simulate human traffic flow
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log('------------------------------------------------');
    console.log(`🏁 SIMULATION COMPLETE`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`💰 Revenue Potential: L. ${successCount * 1500}`);
    console.log(`👉 Check Dashboard: https://rich-aroma-os.vercel.app/src/admin/founders-dashboard.html`);
}

runSimulation();
