-- migrations/20260403_cali_subscriptions.sql
CREATE TABLE IF NOT EXISTS cali_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,
    location_id UUID REFERENCES cali_locations(id),
    selections JSONB NOT NULL, -- The cart items/flavors
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT DEFAULT 'active', -- active, canceled, past_due
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subscription_id to cali_orders to link them back
ALTER TABLE cali_orders ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES cali_subscriptions(id);
