const fetch = require('node-fetch');

const PROD_URL = 'https://www.richaromacoffee.com/api/admin/employees';
const ADMIN_PIN = '4574';

async function runTest() {
    const testEmp = {
        name: "Test Runner " + Date.now(),
        role: "barista",
        pin: "7777",
        pay_type: "salary",
        monthly_salary: 12539.68,
        active: true,
        restaurant_id: 'rich-aroma'
    };

    console.log("--- STARTING PRODUCTION TEST ---");
    console.log(`Target URL: ${PROD_URL}`);
    console.log(`Adding Employee: ${testEmp.name} (Salary: ${testEmp.monthly_salary})`);

    try {
        // 1. ADD
        const addRes = await fetch(PROD_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_PIN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testEmp)
        });

        const addStatus = addRes.status;
        const addData = await addRes.json();

        console.log(`ADD Status: ${addStatus}`);
        console.log(`ADD Response:`, JSON.stringify(addData, null, 2));

        if (addStatus !== 200) {
            throw new Error(`Failed to add employee: ${addData.error || 'Unknown error'}`);
        }

        const newId = addData.id;
        console.log(`✅ SUCCESS: Employee created with ID: ${newId}`);

        // 2. DELETE
        console.log(`Cleaning up: Deleting employee ${newId}...`);
        const delRes = await fetch(`${PROD_URL}?id=${newId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${ADMIN_PIN}`
            }
        });

        console.log(`DELETE Status: ${delRes.status}`);
        if (delRes.ok) {
            console.log("✅ SUCCESS: Employee removed.");
        } else {
            console.log("❌ FAILED to remove employee.");
        }

    } catch (e) {
        console.error("❌ TEST CRITICAL FAILURE:", e.message);
    }
}

runTest();
