const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcXViYWNmY2V0dHdhd2NpbXN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MzIyOCwiZXhwIjoyMDg1MjY5MjI4fQ.8rCrJTxwTeAdyBdM4NS-lbnyxNkS8X1l8vaZw5ZU-2s';
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
