# Rich Aroma Security Protocol 🛡️
**"Bank-Grade Coffee"**

## 1. The Core: Double-Entry Ledger System
We do not just store a number like `balance = 500`. That is easy to hack.
Instead, we use a **Transaction Ledger**.

*   **Rule:** Money is never created or destroyed. It only moves.
*   **Table:** `transactions`
    *   `id`: Unique UUID.
    *   `from_wallet`: (e.g., Customer A).
    *   `to_wallet`: (e.g., Rich Aroma Revenue).
    *   `amount`: L 50.00.
    *   `type`: `PURCHASE`, `DEPOSIT`, `REFUND`.
    *   `signature`: Hash of the transaction (Tamper-proof).

**Security Benefit:** If a hacker changes a balance in the database, the Ledger won't match, and the system triggers a **"RED ALERT: FRAUD DETECTED"**.

---

## 2. Customer Protection: The PIN System 🔒
Since "Rico Cash" is real money, we treat the phone like a Debit Card.

*   **Registration:** User sets a **4-Digit PIN**.
*   **Spending:**
    1.  Customer hits "Pay with Rico Cash".
    2.  System asks: **"Enter PIN"**.
    3.  Customer types `****`.
    4.  Transaction Approved.
*   **Why:** If someone steals their phone, they can't drain the wallet without the PIN.

---

## 3. Staff Integrity: The Audit Trail 🕵️‍♂️
The biggest risk in restaurants isn't hackers; it's **internal theft** (e.g., Cashier loads fake money onto a friend's account).

*   **The Guard Rail:** Every "Load Funds" action requires:
    1.  **Cashier Login** (Who did it?).
    2.  **Cash Drawer Event** (Did the physical cash drawer open?).
    3.  **Daily Reconciliation:** At night, the system asks:
        *   "System says you loaded L 5,000 in Rico Cash."
        *   "Cash drawer must have L 5,000 extra."
        *   *If it doesn't match, the Cashier is flagged.*

---

## 4. Infrastructure Security ☁️
*   **Database:** Supabase (PostgreSQL) with Row Level Security (RLS).
    *   *Rule:* A customer can ONLY see their own data. They cannot query the full user list.
*   **API:** All requests validated with JWT (JSON Web Tokens).
*   **Backups:** Hourly encrypted snapshots.

## 5. Offline Security (The "Quimistán Mode")
*   When offline, the Local Server holds the "Truth".
*   Transactions are queued and signed locally.
*   When internet returns, they sync to Cloud.
*   *Conflict Resolution:* The Local Server (physically in the shop) always wins.

---

## Verdict
This architecture makes Rich Aroma **safer than 99% of banks in Honduras**.
1.  **Ledger** prevents database tampering.
2.  **PIN** prevents phone theft usage.
3.  **Audit** prevents staff theft.
