# Rich Aroma OS - System Architecture v2.0
**"The Self-Driving Shop"**

## Core Philosophy
**Invisible Friction, Maximum Data.** 
We do not build "apps." We build a seamless flow that moves money from the customer to the bank, and food from the kitchen to the table, with zero human data entry.

---

## 1. The Stack (The "Brain")

### Frontend (Customer Experience)
*   **Type:** Progressive Web App (PWA).
*   **Access:** QR Code on table / Link in bio. **No App Store download.**
*   **Flow:**
    1.  **Menu:** Visual, fast, gold/black theme.
    2.  **Cart:** One-tap add.
    3.  **Identity:** User enters **Phone Number** (The unique ID).
    4.  **Checkout:** "Pay at Counter" or "Transfer".
*   **Competitive Advantage:** Speed. Order placed in <30 seconds.

### Backend (The Orchestrator)
*   **Tech:** Python (FastAPI) or Node.js.
*   **Role:** The traffic controller.
*   **Logic:**
    *   Receives Order.
    *   **Loyalty Check:** "Is this phone number in DB? Yes -> Add points. Is it their 10th? -> Auto-discount."
    *   **Routing:** "Drink -> Bar Screen. Food -> Kitchen Screen."

### Database (The Memory)
*   **Tech:** SQLite (Local) + Cloud Sync (Backup).
*   **Tables:**
    *   `Customers`: Phone, Name, LTV (Life Time Value), Favorite Items, Last Visit.
    *   `Orders`: History of every transaction.
    *   `Inventory`: Real-time stock decrements.

---

## 2. The Workflow (The "Happy Path")

1.  **Customer** scans QR at table.
2.  Selects "Crêpe Nutella" + "Latte".
3.  Enters Phone: `9999-9999`. Hits "Order".
4.  **The System**:
    *   Checks Loyalty: "User has 9 points. This is #10."
    *   Updates Order: Adds "FREE REWARD" tag.
    *   **KDS (Kitchen Screen):** *DING!* "Table 4: Crêpe Nutella".
    *   **Bar Screen:** *DING!* "Table 4: Latte".
    *   **POS (Counter):** Logs unpaid ticket L 160.00.
5.  **Customer** eats.
6.  **Customer** walks to counter to pay.
7.  **Cashier** sees "Table 4" on POS. Taps "Pay".
8.  **WhatsApp Bot** (Optional): Sends receipt + "You have 105 points! See you tomorrow."

---

## 3. "Better Than Industry" Features

| Industry Standard | Rich Aroma Standard |
| :--- | :--- |
| **Download App** (Friction) | **Web-Based** (Zero Friction). Works on any phone instantly. |
| **Punch Cards / accounts** | **Invisible Loyalty.** Phone number is the only ID needed. |
| **Siloed Data** | **Omni-channel.** Online, In-store, WhatsApp - all one profile. |
| **Cashier Entry** | **Self-Entry.** Cashier only handles money, not typing. |
| **Dumb POS** | **CRM-POS.** The POS tells you *who* the customer is (e.g., "This is Oscar, he likes dark roast"). |

## 4. Hardware Requirements
*   **Server:** 1x Mac Mini / Laptop (The Brain).
*   **Kitchen:** 1x Tablet (Cheap Android) for KDS.
*   **Counter:** 1x Tablet/Laptop for POS.
*   **Network:** Robust Local WiFi (Cloudflare Tunnel for remote access).

---

## 5. Development Phases
*   **Phase 1 (The Core):** Database + POS + KDS + Web Order Form. (Goal: Data flow).
*   **Phase 2 (The Loyalty):** Automated points tracking + CRM.
*   **Phase 3 (The Magic):** WhatsApp automated receipts & re-engagement.
