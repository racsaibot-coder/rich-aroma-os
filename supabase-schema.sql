-- Rich Aroma OS - Supabase Schema
-- Run this in Supabase SQL Editor

-- Customers (Loyalty members)
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    points INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    visits INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze',
    member_since DATE DEFAULT CURRENT_DATE,
    rico_balance DECIMAL(10,2) DEFAULT 0,
    total_loaded DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer balance history
CREATE TABLE balance_history (
    id SERIAL PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    type TEXT NOT NULL, -- 'load' or 'payment'
    amount DECIMAL(10,2) NOT NULL,
    bonus DECIMAL(10,2) DEFAULT 0,
    order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin TEXT,
    hourly_rate DECIMAL(10,2),
    color TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeclock punches
CREATE TABLE timeclock (
    id SERIAL PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    type TEXT NOT NULL, -- 'in' or 'out'
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule shifts
CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_es TEXT,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    available BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu modifiers
CREATE TABLE menu_modifiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    category TEXT
);

-- Orders
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_number INTEGER NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    customer_id TEXT REFERENCES customers(id),
    discount_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Inventory items
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    current_stock DECIMAL(10,2) DEFAULT 0,
    min_stock DECIMAL(10,2) DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    supplier TEXT,
    last_restock TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waste log
CREATE TABLE waste (
    id SERIAL PRIMARY KEY,
    item_id TEXT REFERENCES inventory(id),
    quantity DECIMAL(10,2) NOT NULL,
    reason TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creators (influencer program)
CREATE TABLE creators (
    id SERIAL PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    discount_code TEXT UNIQUE,
    code_uses INTEGER DEFAULT 0,
    code_sales DECIMAL(10,2) DEFAULT 0,
    code_commission DECIMAL(10,2) DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator submissions
CREATE TABLE creator_submissions (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    creator_name TEXT,
    platform TEXT NOT NULL,
    link TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    points_awarded INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Promo codes
CREATE TABLE promo_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    percent INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    uses INTEGER DEFAULT 0,
    max_uses INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order number sequence
CREATE SEQUENCE order_number_seq START 1;

-- Enable Row Level Security (optional, for auth later)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow anon access for now (we'll lock this down later with auth)
CREATE POLICY "Allow all" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all" ON employees FOR ALL USING (true);
CREATE POLICY "Allow all" ON timeclock FOR ALL USING (true);
CREATE POLICY "Allow all" ON schedule FOR ALL USING (true);
CREATE POLICY "Allow all" ON menu_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON menu_modifiers FOR ALL USING (true);
CREATE POLICY "Allow all" ON inventory FOR ALL USING (true);
CREATE POLICY "Allow all" ON waste FOR ALL USING (true);
CREATE POLICY "Allow all" ON creators FOR ALL USING (true);
CREATE POLICY "Allow all" ON creator_submissions FOR ALL USING (true);
CREATE POLICY "Allow all" ON promo_codes FOR ALL USING (true);
CREATE POLICY "Allow all" ON balance_history FOR ALL USING (true);

-- Business Settings
CREATE TABLE business_settings (
    id SERIAL PRIMARY KEY,
    name TEXT DEFAULT 'Rich Aroma',
    currency TEXT DEFAULT 'HNL',
    tax_rate DECIMAL(5,2) DEFAULT 15.0,
    is_practice_mode BOOLEAN DEFAULT true,
    setup_completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX one_row_only ON business_settings((TRUE));

-- Initial default row
INSERT INTO business_settings (name, is_practice_mode) VALUES ('Rich Aroma', true) ON CONFLICT DO NOTHING;

-- Allow all policy for settings
CREATE POLICY "Allow all" ON business_settings FOR ALL USING (true);
