// api/campaign/valentines.js
const { supabase } = require('../lib/supabase');

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { name, phone, image } = req.body;
    const cleanPhone = phone.replace(/\D/g, '');

    try {
        // 1. Check/Create Customer
        let { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', cleanPhone)
            .single();

        if (!customer) {
            // New User!
            const { data: maxId } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
            const nextNum = maxId?.length ? parseInt(maxId[0].id.slice(1)) + 1 : 1;
            const newId = `C${String(nextNum).padStart(3, '0')}`;

            const { data: newCust, error: createError } = await supabase.from('customers').insert({
                id: newId,
                name: name + " (Parent)", // Assuming parent's phone
                phone: cleanPhone,
                tier: 'bronze',
                points: 0,
                notes: 'Source: Valentine Campaign'
            }).select().single();
            
            if (createError) throw createError;
            customer = newCust;
        }

        // 2. Award Reward (Free Cookie Token)
        // We'll add a "note" or a specific "wallet" entry.
        // For MVP, we'll log it in 'customer_badges' or just update notes if we don't have a sophisticated reward table yet.
        // Let's add a "Valentine Cookie" badge if badges table exists, or just log it.
        
        // Log submission to a new table or just log for now?
        // We'll reuse 'creator_submissions' table but tag it as 'campaign_art' if we can, or just 'notes'.
        
        // Better: Use `creator_submissions` table since it handles file uploads/reviews
        await supabase.from('creator_submissions').insert({
            id: 'art_' + Date.now(),
            phone: cleanPhone,
            creator_name: name,
            platform: 'valentine_art',
            link: 'base64_image_stored', // Ideally we upload to storage, but for now just marking it
            description: 'Valentine Art Submission',
            status: 'approved', // Auto-approve for the prize
            points_awarded: 50 // Points = Cookie equivalent?
        });

        // Add 50 points directly
        await supabase.rpc('increment_points', { user_id: customer.id, amount: 50 });

        res.json({ success: true, message: "Art received!" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}