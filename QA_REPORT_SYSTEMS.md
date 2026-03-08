# Systems Integration & Load Testing QA Report
**Project:** Rich Aroma OS

## 1. Load Testing Script
A load testing script has been successfully created at `tools/simulate_load.js`.
- **Purpose:** Hammers the local API (`http://localhost:8083/api/orders`) with a mix of concurrent pickup and delivery orders.
- **Configuration:** By default, it sends 500 orders with a concurrency limit of 50 to test heavy traffic and concurrent writes.
- **Execution:** Run via `node tools/simulate_load.js` to benchmark system throughput and verify database write resilience.

## 2. KDS Polling Mechanism Review (`kds.html`)
I reviewed the polling implementation in the Kitchen Display System (`public/kds.html`). 

### Findings
- **Interval:** The KDS polls the `/api/orders` endpoint every 3 seconds (`setInterval(fetchOrders, 3000)`).
- **DOM Thrashing Risk:** On every successful fetch, the `render()` function completely clears the DOM (`grid.innerHTML = ''`) and rebuilds all order cards from scratch. 
- **Performance Impact with 50+ Orders:** 
  - **Freezing/Jank:** Completely recreating 50+ complex DOM elements (including nested loops for items and modifiers) every 3 seconds will cause severe layout thrashing. This is highly likely to freeze or stutter low-power tablet devices typically used in kitchens.
  - **Scroll Loss:** Since the entire container is wiped, kitchen staff may lose their scroll position every 3 seconds, making it difficult to read older tickets.
  - **Bandwidth:** Fetching the *entire* list of active orders (and their embedded items) every 3 seconds scales poorly as the active order queue grows.

### Recommendations for KDS
1. **Delta Updates (Frontend):** Instead of `innerHTML = ''`, update the DOM conditionally. Only add new DOM elements for new order IDs, and remove elements for orders that are no longer active.
2. **WebSockets or SSE (Backend/Frontend):** Replace the 3-second short-polling with WebSockets or Server-Sent Events (SSE). The server should only push events when an order is created or updated, drastically reducing network overhead and unnecessary renders.
3. **Pagination/Filtering:** Limit the number of orders fetched at once, or rely more strictly on station-based filtering on the backend rather than the frontend to reduce payload size.