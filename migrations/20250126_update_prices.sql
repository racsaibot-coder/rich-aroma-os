-- Migration: Update Menu Prices (Based on Oscar's input)
-- Date: 2025-01-26

-- 1. Update Coffee Prices
-- Americano (12oz) -> L60.00
UPDATE menu_items 
SET price = 60.00 
WHERE name ILIKE '%Americano%';

-- Latte (12oz) -> L65.00
UPDATE menu_items 
SET price = 65.00 
WHERE name ILIKE '%Latte%';

-- Cappuccino (12oz) -> L65.00
UPDATE menu_items 
SET price = 65.00 
WHERE name ILIKE '%Cappuccino%';

-- 2. Update/Insert Modifiers (Milk Options)
-- Almond Milk -> +L15.00
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM menu_modifiers WHERE name ILIKE '%Almond Milk%') THEN
        UPDATE menu_modifiers SET price = 15.00 WHERE name ILIKE '%Almond Milk%';
    ELSE
        INSERT INTO menu_modifiers (id, name, price, category)
        VALUES ('mod_almond_milk_' || floor(extract(epoch from now())), 'Almond Milk', 15.00, 'milk');
    END IF;
END $$;

-- Skim Milk -> +L15.00
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM menu_modifiers WHERE name ILIKE '%Skim Milk%') THEN
        UPDATE menu_modifiers SET price = 15.00 WHERE name ILIKE '%Skim Milk%';
    ELSE
        INSERT INTO menu_modifiers (id, name, price, category)
        VALUES ('mod_skim_milk_' || floor(extract(epoch from now())), 'Skim Milk', 15.00, 'milk');
    END IF;
END $$;

-- Lactose Free Milk -> +L15.00
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM menu_modifiers WHERE name ILIKE '%Lactose Free Milk%') THEN
        UPDATE menu_modifiers SET price = 15.00 WHERE name ILIKE '%Lactose Free Milk%';
    ELSE
        INSERT INTO menu_modifiers (id, name, price, category)
        VALUES ('mod_lactose_free_' || floor(extract(epoch from now())), 'Lactose Free Milk', 15.00, 'milk');
    END IF;
END $$;
