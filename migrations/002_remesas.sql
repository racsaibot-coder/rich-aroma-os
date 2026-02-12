-- Create Remesas Table
CREATE TABLE IF NOT EXISTS remesas_transactions (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clerk TEXT,
    type TEXT CHECK (type IN ('buy_usd', 'sell_usd')),
    amount_usd DECIMAL(10, 2),
    amount_hnl DECIMAL(10, 2),
    rate DECIMAL(10, 2),
    customer_name TEXT,
    details TEXT
);

-- Enable RLS
ALTER TABLE remesas_transactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (Staff) to insert/view
CREATE POLICY "Staff can view remesas" ON remesas_transactions FOR SELECT USING (true);
CREATE POLICY "Staff can insert remesas" ON remesas_transactions FOR INSERT WITH CHECK (true);

-- Settings table already handles the Rate, we just need a new column or use business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS exchange_rate_buy DECIMAL(10, 2) DEFAULT 24.50;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS exchange_rate_sell DECIMAL(10, 2) DEFAULT 25.00;
