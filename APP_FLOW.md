# App Flow

## 1. POS Flow (Order Entry)
1. **Idle:** Screen shows "Touch to Start" or default menu.
2. **Order:**
   - Tap Item -> Modal for Modifiers -> Add to Cart.
   - (Optional) Tap "Recipe Whisperer" icon -> Show Recipe Modal.
3. **Cart:**
   - Review Items.
   - Add Customer (Phone Search).
   - Add Discount Code.
4. **Checkout:**
   - Select Payment (Cash / Card / Rico Balance).
   - **Cash:** Enter amount tendered -> Show Change.
   - **Rico Balance:** Validate funds -> Deduct.
5. **Completion:**
   - Order sent to Server (API).
   - Ticket prints (if configured).
   - Screen resets to Idle.

## 2. KDS Flow (Fulfillment)
1. **Incoming:** New card appears with "New" badge + sound.
2. **Prep:**
   - Timer starts counting up.
   - Green (0-3m) -> Yellow (3-5m) -> Red (5m+).
3. **Complete:**
   - Staff taps "Done" (or double-taps item to mark individual item done).
   - Order moves to "Completed" history.
   - Customer notified (if SMS configured).

## 3. Customer Self-Order (Future)
1. **Scan QR:** Lands on `/order` page.
2. **Browse:** View Menu.
3. **Select:** Add items.
4. **Pay:** Mobile payment (if supported) or "Pay at Counter".
5. **Track:** Live status screen.
