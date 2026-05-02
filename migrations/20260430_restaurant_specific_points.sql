-- 1. Create table for restaurant-specific points
CREATE TABLE IF NOT EXISTS customer_points (
    id SERIAL PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    points INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, restaurant_id)
);

-- 2. Migrate existing global points to Rich Aroma
-- This ensures existing customers don't lose their points.
INSERT INTO customer_points (customer_id, restaurant_id, points)
SELECT id, 'rich-aroma', COALESCE(points, 0) FROM customers
ON CONFLICT (customer_id, restaurant_id) DO UPDATE SET points = EXCLUDED.points;

-- 3. We keep the 'points' column in customers for a total summary if needed, 
-- but the individual balances will live in the new table.
