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
                message: "Test email sent successfully!",
                details: result 
            });
        } else {
            // If notifyCaliOrder returns null, it hit a catch block.
            res.status(500).json({ 
                success: false, 
                message: "Email service returned a failure. Check server logs or verify Resend configuration.",
                env_status: process.env.RESEND_API_KEY ? 'Key Found' : 'Key Missing'
            });
        }
    } catch (e) {
        res.status(500).json({ 
            success: false,
            error: e.message,
            stack: e.stack
        });
    }
};
