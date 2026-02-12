# CLAUDE.md - Rich Aroma OS Rules

## Operating Principles
- **Documentation First:** Read canonical docs (PRD, TECH_STACK, etc.) before coding.
- **Mobile First:** All UI must be touch-friendly and responsive (360px+).
- **Offline First:** Network requests must handle failure gracefully (Service Worker/Local Fallback).
- **Simplicity:** Prefer vanilla solutions over complex dependencies. Low latency > features.

## Tech Stack
- **Frontend:** Vanilla JS (ES6+), CSS3 (Variables), HTML5. No Frameworks (React/Vue).
- **Backend:** Node.js (Express), Supabase (Auth/DB/Realtime).
- **Database:** PostgreSQL (via Supabase).
- **Hosting:** Local Server (Mac Mini), exposed via Cloudflare Tunnel.

## File Structure
- `server.js` - Main entry point.
- `public/` - Static assets (css, js, images).
- `src/` - Module source code.
  - `pos/` - Point of Sale (pos.html, pos.js).
  - `kds/` - Kitchen Display (kds.html, kds.js).
  - `inventory/` - Inventory logic.
- `data/` - Local JSON backups.

## Styling (FRONTEND_GUIDELINES Summary)
- **Colors:**
  - Gold: `#C9A66B` (Accent)
  - Espresso: `#1E1610` (Background)
  - Cream: `#F5F0EB` (Text)
  - Success: `#22c55e`, Danger: `#ef4444`
- **Typography:** Inter (Sans-serif).
- **Components:** Glassmorphism cards, large touch targets (48px+).

## Coding Conventions
- **Naming:** `camelCase` for JS, `kebab-case` for files/CSS classes.
- **State:** Use local variables for module state, `localStorage` for persistence.
- **API:** Fetch API with async/await. Always try/catch.
- **Comments:** Explain "Why", not "What".

## Session Management
- **Read:** `progress.txt` at start of session.
- **Update:** `progress.txt` after every major task.
- **Learn:** Check `lessons.md` for known pitfalls.
