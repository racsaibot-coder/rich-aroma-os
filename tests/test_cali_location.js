const handler = require('../api/cali.js');

async function testAddLocation() {
    console.log('🧪 Testing Add Location...');

    const req = {
        method: 'POST',
        query: { action: 'locations' },
        body: {
            name: 'Test Drop Point ' + Date.now(),
            city: 'Test City',
            active: true
        },
        headers: {
            authorization: 'Bearer 3620'
        }
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
        await handler(req, res);
        console.log('Response Status:', res.statusCode || 200);
        console.log('Response Data:', res.data);

        if (res.statusCode === 200 || !res.statusCode) {
            console.log('✅ Success! Location added.');
        } else {
            console.error('❌ Failed:', res.data);
        }
    } catch (e) {
        console.error('❌ Error during test:', e);
    }
}

testAddLocation();
