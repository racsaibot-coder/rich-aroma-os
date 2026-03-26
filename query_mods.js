const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcXViYWNmY2V0dHdhd2NpbXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxOTMzNjEsImV4cCI6MjA1Mzc2OTM2MX0.some_fake_key_doesnt_matter_for_reading';
// wait, I don't know the anon key, let's grep it from .env.local
