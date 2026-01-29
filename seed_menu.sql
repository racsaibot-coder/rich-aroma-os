-- Clear existing menu data
DELETE FROM menu_items;
DELETE FROM menu_modifiers;

-- Insert Menu Items

-- Espresso Bar
INSERT INTO menu_items (id, name, price, category, available) VALUES
('classic-latte', 'Classic Latte', 65, 'espresso_bar', true),
('cappuccino', 'Cappuccino', 65, 'espresso_bar', true),
('americano', 'Americano', 60, 'espresso_bar', true),
('espresso', 'Espresso', 40, 'espresso_bar', true),
('caramel-iced-coffee', 'Caramel Iced Coffee w/ Cold Foam', 85, 'espresso_bar', true),
('french-vanilla-ice', 'French Vanilla over Ice', 75, 'espresso_bar', true);

-- Tea & Matcha
INSERT INTO menu_items (id, name, price, category, available) VALUES
('chai-latte', 'Chai Tea Latte', 75, 'tea_matcha', true),
('dirty-chai', 'Dirty Chai', 95, 'tea_matcha', true),
('matcha-latte', 'Matcha Latte', 85, 'tea_matcha', true),
('traditional-matcha', 'Traditional Matcha Tea', 60, 'tea_matcha', true);

-- Supremes & Icees
INSERT INTO menu_items (id, name, price, category, available) VALUES
('strawberry-supreme', 'Strawberry Supreme', 110, 'supremes_icees', true),
('oreo-supreme', 'Oreo Supreme', 110, 'supremes_icees', true),
('lemonade-icee', 'Lemonade Icee', 60, 'supremes_icees', true),
('strawberry-icee', 'Strawberry Icee', 60, 'supremes_icees', true),
('lemonade-strawberry-twist', 'Lemonade & Strawberry Twist', 65, 'supremes_icees', true);

-- Fresh Bowls
INSERT INTO menu_items (id, name, price, category, available) VALUES
('chicken-asado-bowl', 'Chicken Asado Bowl', 150, 'bowls_salads', true),
('vibrant-acai-bowl', 'Vibrant Açai Bowl', 150, 'bowls_salads', true),
('grain-salad', 'Grain Salad of the Day', 130, 'bowls_salads', true);

-- Grill, Toast & Crepes
INSERT INTO menu_items (id, name, price, category, available) VALUES
('chipotle-burrito', 'Chipotle-Style Burrito', 180, 'grill_toast_crepes', true),
('sourdough-avo-toast', 'Sourdough Avocado Toast', 75, 'grill_toast_crepes', true),
('sourdough-chicken-avo', 'Sourdough Chicken Avo Sandwich', 145, 'grill_toast_crepes', true),
('fresh-crepe-sweet', 'Fresh Crepe (Sweet)', 90, 'grill_toast_crepes', true),
('fresh-crepe-savory', 'Fresh Crepe (Savory)', 125, 'grill_toast_crepes', true),
('crepe-combo-3-sweet', 'Crepe Combo (3 Sweet)', 240, 'grill_toast_crepes', true),
('crepe-combo-3-savory', 'Crepe Combo (3 Savory)', 350, 'grill_toast_crepes', true);

-- Bakery
INSERT INTO menu_items (id, name, price, category, available) VALUES
('gf-muffin', 'Gluten Free Muffin', 70, 'bakery', true),
('cookie', 'Cookie', 35, 'bakery', true),
('cheesecake', 'Cheesecake', 110, 'bakery', true),
('flan', 'Flan', 75, 'bakery', true);

-- Weekend Specials (available=false)
INSERT INTO menu_items (id, name, price, category, available) VALUES
('classic-cheeseburger', 'Classic Cheeseburger', 150, 'weekend_specials', false),
('chicken-fingers-basket', 'Chicken Fingers Basket', 110, 'weekend_specials', false),
('breakfast-burrito', 'Breakfast Burrito', 140, 'weekend_specials', false);

-- Insert Modifiers
INSERT INTO menu_modifiers (id, name, price, category) VALUES
('milk-whole', 'Whole Milk', 0, 'milk'),
('milk-skim', 'Skim Milk', 15, 'milk'),
('milk-almond', 'Almond Milk', 15, 'milk'),
('milk-lactose-free', 'Lactose Free Milk', 15, 'milk'),
('crepe-fill-nutella', 'Nutella', 0, 'crepe_filling'),
('crepe-fill-fruit', 'Fruit', 0, 'crepe_filling'),
('crepe-fill-chicken', 'Chicken', 0, 'crepe_filling'),
('crepe-fill-cheese', 'Cheese', 0, 'crepe_filling');
