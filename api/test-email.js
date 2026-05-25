const { notifyCaliOrder } = require('./lib/email-service');

module.exports = async function handler(req, res) {
    const testOrder = {
        id: 'TEST_BOTTLE_123',
        customer_name: 'Oscar (Test)',
        customer_phone: '504-TEST-000',
        total: 25.00,
        notes: '- 5x Bundle [Flavor: Oreo Supreme, Milk: Regular]'
    };

    try {
        console.log("[Test] Sending Cali Distro test email...");
        const result = await notifyCaliOrder(testOrder, 'TEST');
        
        if (result) {
            res.status(200).json({ 
                success: true, 
                message: "Test email sent to boredneenee@gmail.com and owner.",
                details: result 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Email failed. Check if RESEND_API_KEY is set in Vercel Environment Variables." 
            });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
