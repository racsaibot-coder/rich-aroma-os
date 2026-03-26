const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupBucket() {
    console.log('Checking buckets...');
    const { data: buckets, error: fetchError } = await supabase.storage.listBuckets();
    
    if (fetchError) {
        console.error('Error fetching buckets:', fetchError);
        return;
    }
    
    const exists = buckets.find(b => b.name === 'menu-images');
    if (exists) {
        console.log('Bucket "menu-images" already exists.');
    } else {
        console.log('Creating bucket "menu-images"...');
        const { data, error } = await supabase.storage.createBucket('menu-images', {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
            fileSizeLimit: 5242880 // 5MB
        });
        
        if (error) {
            console.error('Error creating bucket:', error);
        } else {
            console.log('Bucket created successfully!', data);
        }
    }
}
setupBucket();
