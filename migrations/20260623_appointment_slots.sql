-- Migration: Create appointment_slots table for professional and salon bookings
-- Date: 2026-06-23

-- 1. Create appointment_slots table
CREATE TABLE IF NOT EXISTS appointment_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'available', -- 'available', 'booked', 'blocked'
    booked_by_order_id TEXT, -- References order table if booked via order
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure same employee isn't double-scheduled at the exact same start time
    UNIQUE (restaurant_id, employee_id, slot_date, start_time)
);

-- 2. Add indexes for high-speed scheduling lookups
CREATE INDEX IF NOT EXISTS idx_appointment_slots_lookup ON appointment_slots(restaurant_id, slot_date, status);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_employee ON appointment_slots(employee_id, slot_date);
