-- Rich Aroma OS - Advanced Staff Scheduling

-- 1. Update employee_schedules to support specific dates instead of just day_of_week
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(id),
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    role TEXT DEFAULT 'barista', -- 'barista', 'manager', 'cook'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, shift_date)
);

-- 2. Business Staffing Needs Table
CREATE TABLE IF NOT EXISTS business_needs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week INTEGER NOT NULL, -- 0-6
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_staff_count INTEGER DEFAULT 1,
    role TEXT DEFAULT 'barista',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(day_of_week, start_time, end_time, role)
);

-- 3. Add admin flag to employees if not exists
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
