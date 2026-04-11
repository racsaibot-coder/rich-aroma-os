-- Cali Distro Tables

-- 1. Products
CREATE TABLE IF NOT EXISTS cali_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    bottles_per_pack INTEGER DEFAULT 1,
    inventory_limit INTEGER,
    active BOOLEAN DEFAULT true,
    image_url TEXT,
    options JSONB DEFAULT jsonb_build_object('milk', jsonb_build_array(jsonb_build_object('name', 'Regular Milk', 'price', 0), jsonb_build_object('name', 'Oat Milk', 'price', 1.0)), 'flavors', jsonb_build_array('Vanilla', 'Caramel', 'Oreo Supreme', 'French Vanilla', 'Mix')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Locations
CREATE TABLE IF NOT EXISTS cali_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    distributor_name TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS cali_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,
    location_id UUID REFERENCES cali_locations(id),
    product_id UUID REFERENCES cali_products(id),
    quantity INTEGER DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending', -- pending, confirmed, rejected
    payment_proof_url TEXT,
    tracking_number TEXT,
    selections JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    payment_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
