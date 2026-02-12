# Rich Aroma OS - User Manual & Onboarding

## 👋 Welcome to Rich Aroma OS
This system runs your entire coffee shop. From taking orders to managing inventory and handling Remesas.

**URL:** `https://oxford-experimental-generates-arnold.trycloudflare.com` (Dev Tunnel)

---

## 🚀 Onboarding Checklist (Day 1)

1.  **Hardware Setup**
    *   [ ] iPad/Tablet mounted at counter.
    *   [ ] Kitchen Display Screen (iPad or Monitor) in bar area.
    *   [ ] Receipt Printer connected.
    *   [ ] Cash Drawer organized (Separate pouch for Remesa USD).

2.  **Software Login**
    *   [ ] Open URL on iPad.
    *   [ ] Login as **Admin** (Default PIN: `1234`).
    *   [ ] Go to **Inventory** -> Verify stock levels match reality.
    *   [ ] Go to **Remesas** -> Set today's Exchange Rate (e.g. 24.50).

---

## 📘 User Instructions

### 1. The Cashier (Point of Sale)
*   **Taking an Order:**
    1.  Tap **POS** tab.
    2.  Tap items (e.g., "Latte", "Croissant").
    3.  Tap **Checkout**.
    4.  Select Payment: **Cash**, **Card**, or **Transfer**.
    5.  Print Receipt.
*   **Remesas (Money Transfer):**
    1.  Customer asks to pick up money.
    2.  Tap **Remesas** tab.
    3.  Tap **Pago Remesa**.
    4.  Enter Secret Code.
    5.  Confirm Amount ($50 USD).
    6.  System calculates Lempiras + Fee.
    7.  Pay cash from **USD Pouch** (or convert from Register if authorized).

### 2. The Barista (Kitchen Display)
*   **Making Drinks:**
    1.  Watch the **KDS** screen.
    2.  New orders appear automatically.
    3.  Tap **"In Progress"** when starting.
    4.  Tap **"Complete"** when serving.
    5.  *Tip:* Red flashing cards mean the order is late (>5 mins).

### 3. The Manager (Dashboard)
*   **Morning Routine:**
    1.  Check **Morning Dashboard** (`/morning`).
    2.  Review yesterday's sales.
    3.  Check Weather (adjust prep: Hot day = More Cold Brew).
*   **Closing:**
    1.  Go to **Reports**.
    2.  Count Cash Drawer.
    3.  Enter amount. System flags any discrepancy.

---

## 🧪 Testing Script (Bug Hunting)

**Role:** You act as "The Chaos Monkey". Try to break it.

### Test 1: The "Morning Rush" Simulation
*   **Action:** Rapidly tap 5 different drinks + 3 food items.
*   **Action:** Checkout with Cash.
*   **Check:** Does the KDS show all items? Does inventory deduct milk/beans?

### Test 2: The "Remesa Swap"
*   **Action:** Go to Remesas.
*   **Action:** Set Exchange Rate to `24.50`.
*   **Action:** "Venta Divisas": Enter `$100`.
*   **Check:** Does it calculate `L2,450`?
*   **Action:** "Payout": Enter `$50`.
*   **Check:** Does history update?

### Test 3: The "Bad Network"
*   **Action:** Turn off WiFi on iPad.
*   **Action:** Try to place an order.
*   **Check:** Does it fail gracefully or crash? (Offline mode coming soon).

### Test 4: The "Inventory Crash"
*   **Action:** Order 50 Lattes (more than you have milk for).
*   **Check:** Does it warn you "Low Stock"?

**Report any weird behavior to Racs immediately.** 🐛
