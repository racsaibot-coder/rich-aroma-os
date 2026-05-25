export default async function handler(req, res) {
    if (req.method === 'GET') {
        res.status(200).json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            env_checks: {
                RESEND_API: process.env.RESEND_API_KEY ? 'PRESENT' : 'MISSING',
                STRIPE_API: process.env.STRIPE_SECRET_KEY ? 'PRESENT' : 'MISSING',
                SUPABASE_URL: process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING'
            }
        });
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}