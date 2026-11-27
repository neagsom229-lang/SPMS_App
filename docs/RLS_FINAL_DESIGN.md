# RLS Final Design — Phase E (PROPOSED, NOT APPLIED)

> **Status: DESIGN/REVIEW ONLY. No RLS policies, grants, or remote DB changes applied.**  
> This document compares Option A and Option B against the actual SPMS codebase and defines a safe implementation path. **No incomplete implementation. No universal access policy presented as tenant isolation.**

## 1. Current state (observed)
- **Authentication**: custom JWT (`jsonwebtoken`, HS256, `JWT_SECRET`), middleware in `backend/src/middleware/auth.js`. Identity is `req.user` from `tbl_users` lookup; tenant from `req.user.tenantId` (null for super admin).
- **Tenant scoping**: application-enforced `WHERE tenant_id = $n` / scoped queries in routes; `requireTenant/getScope` enforces tenant context. Super Admin can pass explicit `tenant_id` for writes and may have null tenant for some reads.
- **DB access pattern**: single shared `pg.Pool` (`backend/src/config/postgres.js`), `db.query()` for simple queries, `client = await pool.connect()` + `BEGIN/COMMIT/ROLLBACK` for transactions. No `SET LOCAL`, no `set_config`, no transaction-local tenant GUC.
- **RLS**: baseline enables no RLS policies for tenant isolation; prior Phase C docs indicate RLS not enabled as defense-in-depth. Remote prior report: public policy count 0.
- **Not using Supabase Auth JWT for DB identity**: `auth.uid()` is **not** the SPMS identity and must not be used for SPMS tenant RLS.

## 2. Option A vs Option B

| Dimension | Option A — App-enforced, role-targeted no-BYPASSRLS | Option B — Transaction-local GUC + table-specific RLS |
|---|---|---|
| Tenant isolation mechanism | App code `WHERE tenant_id` + middleware; DB role lacks BYPASSRLS but no row policies forcing tenant | DB enforces row visibility via RLS policies reading `current_setting('app.tenant_id', true)` or equivalent, set per transaction |
| Security property | Protects against accidental superuser/BYPASSRLS role misuse; **does not protect against SQL bug, missing WHERE, ORM/raw SQL mistake, or compromised app SQL path** | Defense-in-depth: DB rejects cross-tenant rows even if app query omits tenant filter, provided policy/context correct |
| Code change size | Low-medium: role/grant hardening, audit, tests | High: transaction-aware DB abstraction, every tenant-scoped query must run on a client with `SET LOCAL`/`set_config(..., true)` inside transaction; all routes/refactors audited |
| Transaction requirement | Existing behavior acceptable | **Every tenant-scoped request must use same client and transaction scope for set_config + queries**. Pool.query auto-checkout breaks context. |
| Super Admin | App logic handles null/explicit tenant | Policies must explicitly allow super-admin bypass or use separate admin path; easy to get wrong |
| Connection pooler compatibility | Simple | Transaction pooler can break session/transaction-local assumptions; must validate. Session mode/direct preferred. |
| Failure mode | SQL bug leaks data | Missing set_config/policy bug can fail closed (good) or fail open if policy written badly (catastrophic). Universal permissive policy is worse than none. |
| Recommended for SPMS now | Acceptable short-term hardening **only if clearly documented as not DB-enforced isolation** | Preferred long-term defense-in-depth target, but **only as complete, tested implementation** |

## 3. Decision
- **Short-term (staging prep)**: implement Option A hardening prerequisites — dedicated `spms_app` with `NOBYPASSRLS`, least-privilege grants, table-by-table audit, two-tenant integration tests, no superuser app runtime. Document clearly that this is **not** DB-enforced tenant isolation.
- **Target architecture (Phase E/F, only after refactor)**: Option B with transaction-local tenant context and table-specific RLS policies. **Do not enable RLS with permissive catch-all policies. Do not claim complete until every DB access path is covered and tests pass.**

## 4. Option B design requirements (for future approved implementation)

### 4.1 Tenant context mechanism
- Use `SELECT set_config('app.tenant_id', $1::text, true)` (third arg `true` = transaction-local) or `SET LOCAL app.tenant_id = ...` inside an explicit transaction on the **same client**.
- Do **not** use session-level `set_config(..., false)` on pooled connections.
- Do **not** trust `x-tenant-id` header directly; derive tenant from authenticated server-side JWT/user record. For Super Admin explicit tenant writes, validate format and authorization before setting context.
- **Custom GUC warning**: `app.tenant_id` is not an independently authenticated identity. It is a trusted signal set by app code after auth. It is **not** a complete defense against arbitrary SQL execution through the shared app role, SQL injection, or compromised backend code. It reduces blast radius for missing tenant filters.

### 4.2 Transaction-aware DB abstraction (required refactor)
Current code has mixed `db.query(...)` (pool auto-checkout) and manual `client.connect()/BEGIN/COMMIT`. Option B requires:
- A request-scoped DB context/helper that acquires a client, begins transaction where needed, sets tenant GUC, exposes query method, and guarantees release/rollback.
- All tenant-scoped queries must use that scoped client/transaction. Read-only endpoints also need tenant context set before selects under RLS.
- Routes with existing transactions (auth, orders, products, stock, tenants, public, paymentRoutes) must be refactored to set GUC immediately after BEGIN.
- Routes using `pool.query` must be converted or wrapped in a tenant-scoped transaction.

**Estimated refactor surface**: all route files under `backend/src/routes/`, auth middleware-adjacent DB access, any scripts/jobs touching tenant tables.

### 4.3 Policy shape (PROPOSED template — do not apply blindly)
```sql
-- PROPOSED TEMPLATE ONLY - REVIEW PER TABLE/COLUMN/ROLE
ALTER TABLE public.tbl_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_customers FORCE ROW LEVEL SECURITY; -- evaluate carefully; owner/table-owner behavior

-- Example tenant isolation policy (template)
CREATE POLICY tenant_isolation_select ON public.tbl_customers
  FOR SELECT
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
  );

-- Separate policies for INSERT/UPDATE/DELETE with WITH CHECK as needed.
-- Do NOT create a universal "USING (true)" policy for spms_app.
```

**Policy rules:**
- Table-specific policies per operation (SELECT/INSERT/UPDATE/DELETE) as needed.
- Default deny: no policy => no access for non-owner roles subject to RLS.
- Super Admin behavior explicit and audited; prefer separate admin connection/role or carefully constrained `app.is_super_admin` GUC set only by trusted server code.
- `FORCE ROW LEVEL SECURITY` considered for table owner if app role owns tables (usually not desired). Avoid making app role table owner.
- Special-case tables: `tenants`, `schema_migrations`, `tbl_users` (may contain cross-tenant/super-admin rows), public storefront reads, audit logs.

### 4.4 Tables requiring special handling
| Table / area | Consideration |
|---|---|
| `tenants` | Tenant self-read/update vs super-admin management; registration/onboarding flows |
| `tbl_users` | Auth lookup by username/userid before tenant context known; super-admin users have null tenant; password reset/change flows |
| `store_settings` | Public storefront reads by subdomain/tenant; admin writes scoped |
| `tbl_activity_logs` | Insert by app; reads scoped; super-admin cross-tenant audit |
| `schema_migrations` | Migration role only; app should have no access |
| Public routes (`/api/public/*`) | Resolve tenant by subdomain/store slug before setting tenant GUC; no authenticated user JWT |
| Payment/webhook routes | Verify tenant context from trusted server-side data, not untrusted payload alone |

## 5. Route/access-path review checklist (before Option B implementation)
- [ ] Every route file audited for DB calls and table access.
- [ ] Every `pool.query` converted to scoped client or approved exception documented.
- [ ] Every existing transaction sets tenant GUC as first statement after BEGIN.
- [ ] Super Admin null-tenant reads have explicit policy/path.
- [ ] Public storefront routes set tenant context from validated store/subdomain.
- [ ] Auth login/refresh/user lookup works before tenant RLS context (or uses bypass path with extreme care).
- [ ] Migration runner uses `spms_migrator`, not `spms_app`.
- [ ] Background jobs/scripts have defined tenant context model.
- [ ] Tests cover cross-tenant SELECT/INSERT/UPDATE/DELETE, missing context, wrong context, super admin.

## 6. Verification plan (staging only, after approved implementation)
```sql
-- RLS enabled
SELECT schemaname, tablename, rowsecurity, relforcerowsecurity
FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename
JOIN pg_namespace n ON n.nspname=t.schemaname AND n.oid=c.relnamespace
WHERE schemaname='public' ORDER BY tablename;

-- Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
```

Negative tests must include: Tenant A cannot read/update/delete Tenant B rows; missing `app.tenant_id` fails closed; wrong tenant fails closed; super-admin explicit scope works only where authorized.

## 7. Recommendation
- **Now**: complete Option A hardening design, role/grant audit, and staging prep. Do not enable RLS.
- **Next**: implement Option B as a dedicated refactor with transaction-aware DB abstraction, table-specific policies, and owner-approved two-tenant tests. Treat as security-critical change with full regression/E2E/negative tests.