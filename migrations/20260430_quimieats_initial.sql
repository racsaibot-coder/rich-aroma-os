-- Create QuimiEats Leads table
CREATE TABLE IF NOT EXISTS quimieats_leads (
    id SERIAL PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    category TEXT, -- 'restaurante', 'reposteria', 'bebidas', 'otro'
    status TEXT DEFAULT 'new', -- 'new', 'contacted', 'partner'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
ALTER TABLE quimieats_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON quimieats_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin select" ON quimieats_leads FOR SELECT USING (true);
