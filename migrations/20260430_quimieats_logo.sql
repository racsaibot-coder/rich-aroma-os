-- Add logo_url to QuimiEats leads
ALTER TABLE quimieats_leads ADD COLUMN IF NOT EXISTS logo_url TEXT;
