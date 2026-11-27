# SPMS Phase C — RLS / Role / Tenant Isolation Design (Review Only)

> **Status:** Design proposal only. No remote DB changes applied. No RLS/role/grant changes executed on Supabase.

## Context (verified)
- App auth: custom Express JWT (HS256, `JWT_SECRET`), DB user lookup, token version, status checks. **Not Supabase Auth**.
- DB access: Node `pg` Pool direct connection (`backend/src/config/postgres.js`).
- RLS: baseline enables RLS on 4 tables; migration 022 enables RLS on all public tables and revokes ALL on tables/sequences from `anon`,`authenticated` when present; migration 025 revokes default privileges in `public` from `anon`,`authenticated`. **No tenant policies exist.**
- App does **not** set `set_config('app.tenant_id', ...)` or any tenant GUC. Tenant isolation is enforced in app middleware/routes (`requireTenant/getScope`, tenant filters).
- **Do not assume `auth.uid()` maps to SPMS users.**

## Option A — Dedicated backend role + explicit grants + backend-enforced tenant isolation

### Summary
Use a dedicated least-privilege PostgreSQL role for the backend. Keep RLS enabled. Revoke anon/authenticated. Do not rely on Supabase Auth claims. Tenant isolation remains enforced by Express/JWT/app query scoping. The backend role can technically access all tenant rows it has grants for; this must be documented as an accepted risk unless Option B is implemented.

### Role design
```sql
-- REVIEW ONLY - DO NOT EXECUTE REMOTELY WITHOUT APPROVAL
CREATE ROLE spms_app LOGIN PASSWORD '<secret-from-secret-store>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT CONNECT, TEMPORARY ON DATABASE postgres TO spms_app; -- adjust DB name if needed
GRANT USAGE ON SCHEMA public TO spms_app;
```

### Grants matrix (minimum required; verify against actual queries before apply)
| Object type | Grant | Rationale |
|---|---|---|
| `public` schema | `USAGE` | access objects |
| App tables in `public` | `SELECT, INSERT, UPDATE, DELETE` as required per table | CRUD. Prefer table-specific grants after query audit. |
| Sequences/identity sequences | `USAGE, SELECT` (and `UPDATE` only where needed) | serial/identity inserts |
| Functions/triggers | `EXECUTE` only where needed | `sync_product_stock()` trigger runs as table owner context; app role usually needs no direct execute unless called. |

**Table-specific starting point (to be validated by query audit):**
- Read/write tenant business tables: `tenants, tbl_users, tbl_categories, tbl_products, tbl_stock, tbl_stock_log, tbl_customers, tbl_suppliers, tbl_orders, tbl_order_items, tbl_payment, tbl_payment_method, tbl_held_sales, tbl_warranty, tbl_service_requests, store_settings, tbl_activity_logs, khqr_sessions, khqr_webhook_events, tenant_order_counters` — grant only needed DML.
- `schema_migrations`: migration runner needs `SELECT, INSERT, UPDATE`/DDL as appropriate; normal app runtime should not need write access. Consider separate migration role.

### RLS posture under Option A
- Keep RLS enabled (022). Do **not** disable RLS. Do **not** add permissive `USING (true)` policies for anon/authenticated.
- Since no tenant policies exist, a non-owner role subject to RLS will be denied. Therefore Option A requires one of these explicit, reviewed choices:
  1. **App role owns app tables** (not recommended on Supabase managed DB; ownership has broad power). Avoid.
  2. **App role has BYPASSRLS** — simplest compatibility, but means DB does not enforce tenant isolation for that role. **Must be explicit owner-approved and documented.** Not silent.
  3. **Create permissive policies for app role only** (e.g., `TO spms_app USING (true) WITH CHECK (true)`) while keeping anon/authenticated denied — preserves RLS boundary against PostgREST roles but not tenant isolation. Better than BYPASSRLS for scope, still app-enforced tenancy.

**Option A recommendation:** if choosing A, prefer (3) role-targeted policies for `spms_app` only, with anon/authenticated revoked, plus strict app tenant scoping tests. Do not grant BYPASSRLS silently. Do not use postgres superuser.

### Backend-enforced isolation controls
- JWT validation + DB user status/token version.
- `requireTenant/getScope` on every tenant route; reject frontend-supplied tenant IDs not authorized for user.
- Super Admin writes require explicit tenant context.
- Parameterized SQL only; no dynamic SQL identifiers from user input.
- Tenant-isolation integration tests for >=2 tenants.

### Tradeoffs
- **Pros:** minimal code change, compatible with current app.
- **Cons:** DB cannot prevent cross-tenant access if app bug/SQL injection occurs through app role. Backend role can access all tenants.

## Option B — Transaction-scoped tenant context + RLS policies

### Summary
Set tenant context inside a DB transaction after server-side authorization, then enforce tenant isolation with PostgreSQL RLS policies using `current_setting(...)`. Strongest defense-in-depth.

### Trust model / limitations
- `set_config('app.tenant_id', ..., true)` is **trusted only if set by trusted backend code** on a trusted DB connection. It is **not** secure if untrusted roles can call `set_config` or if SQL injection can execute arbitrary SQL.
- Custom GUCs are not cryptographic identity. Do not use them as a substitute for server-side authz.
- With direct pg driver, the backend controls the connection; ensure only the backend role can connect with these privileges.
- `current_setting('app.tenant_id', true)` returns NULL if unset; policies must fail closed.

### Required backend pattern
For any request/operation depending on tenant RLS:
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
  await client.query("SELECT set_config('app.is_super_admin', $1, true)", [isSuperAdmin ? '1' : '0']);
  // ... all tenant-scoped queries on same client ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  client.release();
}
```
**Do not** use separate `pool.query()` calls for operations depending on transaction-local context.

### Access-path inspection (repo grep)
Routes using `pool.connect()`/transactions: `auth.js`, `orders.js` (multiple), `paymentRoutes.js`, `products.js`, `public.js`, `stock.js`, `tenants.js`. Many other routes use `db.query()` single statements - for Option B, every tenant-scoped read/write must run on a client with transaction-local tenant context. This is a cross-cutting refactor.

### Example policies (review only; adapt per table/column names)
```sql
-- Example for a tenant-scoped table with tenant_id
ALTER TABLE public.tbl_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spms_tenant_select ON public.tbl_products;
CREATE POLICY spms_tenant_select ON public.tbl_products
  FOR SELECT TO spms_app
  USING (
    current_setting('app.is_super_admin', true) = '1'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int
  );
CREATE POLICY spms_tenant_insert ON public.tbl_products
  FOR INSERT TO spms_app
  WITH CHECK (
    current_setting('app.is_super_admin', true) = '1'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int
  );
CREATE POLICY spms_tenant_update ON public.tbl_products
  FOR UPDATE TO spms_app
  USING (
    current_setting('app.is_super_admin', true) = '1'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = '1'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int
  );
CREATE POLICY spms_tenant_delete ON public.tbl_products
  FOR DELETE TO spms_app
  USING (
    current_setting('app.is_super_admin', true) = '1'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int
  );
```

Special cases needing table-specific policies:
- `tenants`: Super Admin global; tenant users may read own tenant row only.
- `tbl_users`: self/tenant admin rules; Super Admin cross-tenant; prevent privilege escalation.
- `schema_migrations`: no app runtime access; migration role only.
- `khqr_webhook_events`: system/migration context; no tenant_id.
- Tables with nullable tenant_id or super-admin rows must be carefully handled.

### Super Admin behavior
- Only after server-side auth confirms `isSuperAdmin`.
- For cross-tenant reads, set `app.is_super_admin='1'` in transaction; policies allow.
- For tenant-specific writes, prefer setting explicit `app.tenant_id` and not relying on super-admin bypass except audited admin endpoints.
- Never allow frontend to set super-admin GUC.

### Tradeoffs
- **Pros:** strong DB-enforced tenant isolation, defense-in-depth.
- **Cons:** large refactor, transaction discipline required, performance/complexity overhead, risk of incomplete rollout. Must audit every query path.

## Recommended path
1. **Now:** Option A with role-targeted policies for `spms_app` only (or explicit BYPASSRLS decision documented), anon/authenticated revoked, no postgres superuser for app. Complete query audit and tenant tests.
2. **Next:** Plan Option B as staged migration with transaction wrapper, per-table policies, and integration tests. Do not partially apply.