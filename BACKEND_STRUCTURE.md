# Backend Structure

## Database Schema (Supabase/PostgreSQL)

### Tables

#### `menu_items`
- `id` (text, PK)
- `name` (text)
- `price` (numeric)
- `category` (text)
- `available` (bool)

#### `orders`
- `id` (text, PK) - Format: "ORD-0001"
- `items` (jsonb) - Array of item objects
- `total` (numeric)
- `status` (text) - pending, completed, cancelled
- `payment_method` (text)
- `created_at` (timestamptz)

#### `customers`
- `id` (text, PK)
- `name` (text)
- `phone` (text, Unique)
- `points` (int)
- `cash_balance` (numeric)

#### `inventory`
- `id` (text, PK)
- `name` (text)
- `quantity` (numeric)
- `unit` (text)

### API Endpoints

#### GET `/api/menu`
Returns full menu JSON + modifiers.

#### POST `/api/orders`
Creates new order. Triggers inventory deduction.
Response: Order Object.

#### GET `/api/orders`
Returns recent orders (for KDS).

#### POST `/api/customers/:id/load-balance`
Loads funds to customer account.
Body: `{ amount: 100 }`

## Local Backup
- Path: `data/orders.json`
- Logic: Every POST to `/api/orders` appends to this file instantly.
