-- Rich Aroma OS - Staff & Profile Enhancements

-- 1. Favorites Column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorites TEXT[] DEFAULT '{}';

-- 2. Order Scheduling Column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- 3. Time Clock & Scheduling Tables
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(id),
    type TEXT NOT NULL, -- 'in', 'out', 'break_start', 'break_end'
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(id),
    day_of_week INTEGER NOT NULL, -- 0 (Sun) to 6 (Sat)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_off_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(id),
    day_of_week INTEGER NOT NULL,
    is_available BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, day_of_week)
);
