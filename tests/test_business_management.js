const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'https://rich-aroma-os.vercel.app';
const ADMIN_PIN = '4574'; // Oscar's Master PIN

async function testBusinessManagement() {
    console.log('🧪 Starting Business Management Test...');

    const testBusiness = {
        name: 'Test Burger ' + Date.now(),
        phone: '50400000000',
        category: 'restaurante',
        logo_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'
    };

    try {
        // 1. Create a business (Quick Add)
        console.log('Creating new business...');
        const createRes = await fetch(`${BASE_URL}/api/admin?action=quick_add_restaurant`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PIN}`
            },
            body: JSON.stringify(testBusiness)
        });
        
        const created = await createRes.json();
        if (!createRes.ok) throw new Error(JSON.stringify(created));
        console.log('✅ Business Created:', created.name, `(ID: ${created.id})`);

        // 2. Edit the business
        console.log('Editing business details...');
        const updatedName = testBusiness.name + ' UPDATED';
        const editRes = await fetch(`${BASE_URL}/api/admin?action=update_restaurant_details`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PIN}`
            },
            body: JSON.stringify({
                id: created.id,
                name: updatedName,
                phone: '50411111111',
                logo_url: testBusiness.logo_url,
                oldName: created.name
            })
        });

        const edited = await editRes.json();
        if (!editRes.ok) throw new Error(JSON.stringify(edited));
        console.log('✅ Business Updated:', edited.restaurant.name);

        // 3. Verify in Active List
        console.log('Verifying in active business list...');
        const listRes = await fetch(`${BASE_URL}/api/admin?action=quimieats_active`);
        const activeList = await listRes.json();
        
        const found = activeList.find(b => b.id === created.id);
        if (found && found.name === updatedName) {
            console.log('✅ Verification Successful: Business found in active list with correct details.');
        } else {
            console.error('❌ Verification Failed: Business not found or details mismatch.');
        }

        // 4. Cleanup (Optional: use the cleanup action)
        console.log('Cleaning up test data...');
        const cleanupRes = await fetch(`${BASE_URL}/api/admin?action=cleanup_duplicates`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PIN}`
            }
        });
        const cleanupData = await cleanupRes.json();
        console.log(`✅ Cleanup finished. Deleted ${cleanupData.deleted} test/duplicate records.`);

        console.log('🎉 BUSINESS MANAGEMENT TEST PASSED.');
    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
}

testBusinessManagement();
