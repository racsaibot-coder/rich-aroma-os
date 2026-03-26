-- Separate tables for the Cali Operation
CREATE TABLE IF NOT EXISTS cali_products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    bottles_per_pack INTEGER DEFAULT 1,
    inventory_limit INTEGER, -- NULL means unlimited
    active BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cali_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    distributor_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cali_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    location_id UUID REFERENCES cali_locations(id),
    total DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, paid, fulfilled
    payment_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cali_order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES cali_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES cali_products(id),
    quantity INTEGER DEFAULT 1,
    price_at_time DECIMAL(10,2) NOT NULL
);
