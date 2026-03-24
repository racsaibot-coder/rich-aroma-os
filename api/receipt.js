const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query; // comes from the route if mapped properly, or we pass it in body
        const { imageBase64, orderId, fileName } = req.body;
        
        const targetId = id || orderId;

        if (!targetId || !imageBase64) {
            return res.status(400).json({ error: 'Missing orderId or image' });
        }

        // Convert base64 to buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
        const ext = mimeType.split('/')[1] || 'png';
        
        const cleanName = (fileName || 'receipt').replace(/[^a-zA-Z0-9.]/g, '');
        const storagePath = `receipts/${targetId}_${Date.now()}_${cleanName}.${ext}`;

        const { data, error } = await supabase.storage
            .from('menu-images')
            .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('menu-images')
            .getPublicUrl(storagePath);

        const { error: dbError } = await supabase
            .from('orders')
            .update({ transfer_receipt_url: publicUrl, status: 'pending_verification' }) // Set to pending verification for POS
            .eq('id', targetId);

        if (dbError) throw dbError;

        return res.status(200).json({ success: true, url: publicUrl });

    } catch (error) {
        console.error('Upload Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
