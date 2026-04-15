-- Add hourly_rate to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00;
