-- Add Card and Transfer declaration fields to cash_shifts
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS declared_card DECIMAL(10,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS declared_transfer DECIMAL(10,2) DEFAULT 0;

-- Create Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category TEXT, -- 'electricity', 'internet', 'rent', 'supplies', 'other'
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
