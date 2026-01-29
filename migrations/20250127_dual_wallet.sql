-- Migration: Dual Wallet System
-- Date: 2025-01-27

-- Rename rico_balance to cash_balance (assuming rico_balance existed)
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='customers' and column_name='rico_balance')
  THEN
      ALTER TABLE customers RENAME COLUMN rico_balance TO cash_balance;
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'membership_credit') THEN
        ALTER TABLE customers ADD COLUMN membership_credit DECIMAL(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'membership_credit_expires_at') THEN
        ALTER TABLE customers ADD COLUMN membership_credit_expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_vip') THEN
        ALTER TABLE customers ADD COLUMN is_vip BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'vip_expiry') THEN
        ALTER TABLE customers ADD COLUMN vip_expiry TIMESTAMPTZ;
    END IF;
END $$;
