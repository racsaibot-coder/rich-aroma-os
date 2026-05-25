const adminHandler = require('../api/admin.js');

// Mock req and res
async function runLocalTest() {
    console.log('🧪 Starting Local Integration Test...');

    const testBusiness = {
        name: 'Local Test Burger ' + Date.now(),
        phone: '50400000000',
        category: 'restaurante',
        logo_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'
    };

    const req = {
        method: 'POST',
        query: { action: 'quick_add_restaurant' },
        body: testBusiness,
        headers: { authorization: 'Bearer 4574' }
    };

    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.data = data;
            return this;
        },
        setHeader: function() {}
    };

    try {
        await adminHandler(req, res);
        
        if (res.statusCode === 200 || !res.statusCode) {
            console.log('✅ Local Creation Successful:', res.data.restaurant.name, `(Category: ${res.data.restaurant.category})`);
            
            // Now test update
            const updateReq = {
                method: 'POST',
                query: { action: 'update_restaurant_details' },
                body: {
                    id: res.data.restaurant.id,
                    name: res.data.restaurant.name + ' UPDATED',
                    phone: '50499999999',
                    logo_url: testBusiness.logo_url,
                    oldName: res.data.restaurant.name,
                    category: 'pharmacy'
                },
                headers: { authorization: 'Bearer 4574' }
            };
            
            const updateRes = {
                status: function(code) { this.statusCode = code; return this; },
                json: function(data) { this.data = data; return this; },
                setHeader: function() {}
            };
            
            await adminHandler(updateReq, updateRes);
            
            if (updateRes.statusCode === 200 || !updateRes.statusCode) {
                console.log('✅ Local Update Successful:', updateRes.data.restaurant.name);
                console.log('🎉 LOCAL BUSINESS MANAGEMENT TEST PASSED.');
            } else {
                console.error('❌ Local Update Failed:', updateRes.data);
            }

        } else {
            console.error('❌ Local Creation Failed:', res.data);
        }
    } catch (e) {
        console.error('❌ Test Errored:', e);
    }
}

runLocalTest();
