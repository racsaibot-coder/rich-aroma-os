-- Migration: VIP Membership Tier
-- Rule 1: Daily Drink Validation
-- Rule 2: Monthly Rico Cash Sweep
-- Rule 3: Conditional 10% Discount (House Made only)

-- 1. Extend Menu Items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_house_made BOOLEAN DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_vip_free_eligible BOOLEAN DEFAULT false;

-- 2. Extend Customers for VIP Logic
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_free_drink_date DATE; -- Format: YYYY-MM-DD
ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_renewal_date DATE;    -- Next date to sweep and deposit

-- 3. Audit Log for Membership Financials
CREATE TABLE IF NOT EXISTS membership_billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT REFERENCES customers(id),
    event_type TEXT, -- 'renewal_sweep', 'deposit'
    amount_swept DECIMAL(10,2), -- The "breakage"
    amount_deposited DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
