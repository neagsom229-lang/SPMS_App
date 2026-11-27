# SPMS Security and RLS

## Current security model (as implemented)
- **Authentication**: Express JWT (`backend/src/middleware/auth.js`). Tokens verified with HS256 `JWT_SECRET`; user loaded from DB; checks status, tenant status, token version, `must_change_password`.
- **Authorization**: Role/scope middleware (`rolePolicy.js`, `requireTenant/getScope`, `requireSuperAdmin`). Admin/staff/viewer/super-admin rules enforced in app layer.
- **Tenant isolation**: Application-level. Tenant-scoped queries should include tenant filters/scope; Super Admin writes require explicit tenant context. Frontend tenant IDs must not be trusted without server-side validation against authenticated user.
- **DB connectivity**: `pg` pool, parameterized queries (`db.query(text, params)`), TLS verification enabled for Supabase/cloud hosts, no SSL verification bypass.

## RLS status
- Baseline enables RLS on 4 tables; migration 022 enables RLS on all public tables and revokes table/sequence ALL from `anon` and `authenticated` (if present). Migration 025 revokes default privileges in `public` from `anon`/`authenticated`.
- **No tenant RLS policies are defined.** The backend does not set Postgres tenant GUCs (`set_config('app.tenant_id', ...)`).
- Effect: with RLS enabled and no policies, roles subject to RLS are denied by default; table owners bypass RLS unless `FORCE ROW LEVEL SECURITY`; roles with `BYPASSRLS` bypass RLS. On Supabase, `anon`/`authenticated` are relevant to PostgREST/Data API exposure.

## Option A — Backend-enforced isolation with restricted DB role (recommended for current codebase)
**Description:** Keep tenant isolation in Express/JWT/app queries. Use a dedicated least-privilege backend DB role (not postgres superuser). Revoke anon/authenticated access. Keep RLS enabled to protect PostgREST exposure; grant app role only required privileges. If RLS blocks the app role due no policies, use a carefully reviewed role privilege strategy (explicit grants; avoid superuser; avoid broad BYPASSRLS unless explicitly approved and documented).

**Pros:** Minimal code change; compatible with existing app; quick to deploy safely.  
**Cons:** DB-layer tenant isolation depends on app correctness; SQL injection or privileged role misuse has higher blast radius.  
**Required controls:** parameterized SQL everywhere, strict tenant scoping tests, least-privilege role, no frontend-trusted tenant IDs, audit logging, secrets in env store.

## Option B — PostgreSQL transaction-scoped tenant context + RLS policies (strongest defense-in-depth)
**Description:** Add RLS policies per tenant table using `current_setting('app.tenant_id', true)` (and role/user context as needed). In every request/transaction, backend sets `SET LOCAL app.tenant_id = ...` (and optionally user role) after authenticating and validating scope. Super Admin/system operations get explicit, reviewed policies/paths.

**Pros:** Strong DB-enforced tenant isolation; protects against many app bugs.  
**Cons:** Requires backend changes across DB access paths, careful transaction management, Super Admin bypass design, and thorough testing. Risk of breaking queries if rolled out incompletely.  
**Required controls:** transaction wrapper, SET LOCAL on every scoped query, policy tests, migration plan, staged rollout.

## Recommendation
- **Short term (pre-live init):** Option A with strict controls and explicit role/grant design. Do not use postgres superuser. Do not disable RLS. Do not trust frontend tenant IDs. Do not grant BYPASSRLS silently.
- **Medium term:** Plan Option B as a defense-in-depth upgrade with dedicated migrations and app refactor.

## Non-negotiable rules
- No SSL verification bypass.
- No secrets in logs/CLI.
- No remote RLS/role/grant changes without reviewed SQL and explicit owner approval.
- No `supabase db push/reset` or remote custom runner execution without approval.