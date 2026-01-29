-- Add Delivery Zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for delivery_zones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON delivery_zones FOR ALL USING (true);

-- Update Orders table to support delivery and split payments
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id INTEGER REFERENCES delivery_zones(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
