// api/upload-receipt.js
const { supabase } = require('./lib/supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { imageBase64, ticketCode, refNumber } = req.body;

    // 1. Check Duplicate Ref (DB Check)
    const { data: existingRef } = await supabase.from('receipts').select('id').eq('ref_number', refNumber).single();
    if (existingRef) {
        return res.status(409).json({ error: "Reference already used.", isDuplicate: true });
    }

    // 2. Check Duplicate Image Hash
    const hash = crypto.createHash('md5').update(imageBase64).digest('hex');
    const { data: existingHash } = await supabase.from('receipts').select('id').eq('image_hash', hash).single();
    if (existingHash) {
        return res.status(409).json({ error: "Receipt image already used.", isDuplicate: true });
    }

    // 3. Store Receipt Metadata
    await supabase.from('receipts').insert({
        ticket_code: ticketCode,
        ref_number: refNumber,
        image_hash: hash,
        // image_data: imageBase64 -- Optional: Store in Storage Bucket instead of DB column if large
    });

    res.json({ success: true, message: "Receipt verified." });
}