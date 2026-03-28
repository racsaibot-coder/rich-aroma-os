-- Run this in Supabase SQL editor:
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin VARCHAR(4) DEFAULT NULL;
