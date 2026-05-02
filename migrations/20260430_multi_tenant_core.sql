-- 1. Create Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    contact_phone TEXT,
    status TEXT DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert Rich Aroma as the flagship
INSERT INTO restaurants (id, name, status) 
VALUES ('rich-aroma', 'Rich Aroma Coffee', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Add restaurant_id to all operational tables
-- We use 'rich-aroma' as the default so existing code continues to work perfectly.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS restaurant_id TEXT DEFAULT 'rich-aroma' REFERENCES restaurants(id);

-- 4. Create the Central Ledger for Rico Cash Settlements
-- This tracks when Rico Cash is spent at a restaurant so you can pay them back.
CREATE TABLE IF NOT EXISTS quimieats_ledger (
    id SERIAL PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    customer_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL, -- Positive for money the restaurant IS OWED by the platform
    type TEXT NOT NULL, -- 'rico_payment', 'payout', 'commission'
    order_id TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'settled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
