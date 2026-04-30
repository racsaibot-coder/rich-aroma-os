-- Add role-based inventory tracking
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS daily_count_role TEXT; -- 'barista', 'cook', 'admin', 'none'

-- Update existing items to default roles based on keywords
UPDATE inventory SET daily_count_role = 'barista' WHERE name ILIKE '%leche%' OR name ILIKE '%milk%' OR name ILIKE '%café%' OR name ILIKE '%coffee%';
UPDATE inventory SET daily_count_role = 'cook' WHERE name ILIKE '%baleada%' OR name ILIKE '%dough%' OR name ILIKE '%queso%' OR name ILIKE '%frijol%';
UPDATE inventory SET daily_count_role = 'none' WHERE daily_count_role IS NULL;
