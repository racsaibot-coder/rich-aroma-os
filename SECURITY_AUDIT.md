# Rich Aroma OS - Security Audit & Hardening Report

## 1. Authentication Audit

### Findings
- **No Middleware**: The `server.js` file contained no authentication middleware. All API routes, including sensitive Admin routes (`/api/admin/*`), were publicly accessible to anyone with network access.
- **Implicit Trust**: The system relied entirely on obscurity or local network trust.
- **Hardcoded Keys**: The server falls back to a hardcoded Supabase Anon key if environment variables are missing. While better than a Service Role key, it still allows anonymous access if RLS is weak.
- **Session Validation**: There was no check for valid Supabase sessions.

### Fixes
- **Implemented Auth Middleware**: Added `requireAuth` middleware to `server.js` that verifies the `Authorization: Bearer <token>` header using `supabase.auth.getUser()`.
- **Role-Based Access Control (RBAC)**: Added `requireAdmin` middleware that strictly enforces `role = 'admin'`.
- **Per-Request Supabase Client**: The server now creates a scoped Supabase client for each request using the user's token, ensuring RLS policies are respected (instead of using the server's global key).

## 2. Data Safety

### Findings
- **RLS Enabled but Bypassed**: `supabase-schema.sql` enabled RLS but included `CREATE POLICY "Allow all" ... USING (true)` for every table, effectively disabling security.
- **Exposed Keys**: No Service Role keys were found in client-side code (Good). The server uses the Anon key by default.

### Fixes
- **Hardened RLS Policies**:
    - Removed "Allow all" policies.
    - `menu_items`: Public Read, Admin Write.
    - `orders`: Public Create (for POS), Admin Read/Write.
    - `employees`, `inventory`, `business_settings`: Admin Only.
    - `customers`: Public Create/Read (for Loyalty), Admin Write.

## 3. Input Validation

### Findings
- **SQL Injection**: The project uses Supabase JS client (Postgrest), which automatically parameterizes queries, mitigating most SQL injection risks.
- **XSS Vulnerabilities**: Client-side rendering in `admin.html` (and likely others) used `innerHTML` with unescaped data (e.g., `item.name`). A malicious menu item name could execute scripts.

### Fixes
- **Output Encoding**: Added `escapeHtml()` utility function in `admin.html` and applied it to all dynamic data rendering (Menu, Employees, etc.).

## 4. Recommendations for Next Steps
- **Client-Side Auth Integration**: The current frontend (`admin.html`) does not currently send the `Authorization` header. You must update the client to implement a Login flow (using `supabase.auth.signInWithPassword`) and attach the token to all `fetch` requests. The backend is now secured, so the current frontend *will fail* until this is done.
- **Environment Variables**: Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for background tasks) are set in the production environment.
