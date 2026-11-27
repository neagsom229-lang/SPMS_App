# Role and Grants Design — Phase E (PROPOSED, NOT APPLIED)

> **Status: DESIGN/REVIEW ONLY. No remote roles/grants/default privileges created or modified.**  
> All SQL below is **PROPOSED** for staging review after read-only remote inventory and owner approval. Do not run on production.

## 1. Goals
- Dedicated Express runtime identity (`spms_app`): least privilege, no superuser/createrole/createdb/bypassrls, no DDL.
- Separate migration identity (`spms_migrator`): used only for approved migrations/schema changes; owns or has controlled DDL rights on target schema; no routine app use.
- No `postgres` or `service_role` as normal Express DB account.
- Grants based on actual route/table access audit, not generic "grant all on schema".

## 2. Current runtime observations (local code)
- DB client: single shared `pg.Pool` in `backend/src/config/postgres.js`, exported as `db.query/connect/end`.
- All routes import same pool/db; most queries are `pool.query(...)` directly. Some flows use `client = await pool.connect(); BEGIN/COMMIT/ROLLBACK; client.query(...)` (auth, products, stock, orders, tenants, public checkout, payment routes).
- Tenant scoping is enforced in application code via `authenticate` + `getScope/requireTenant` and `WHERE tenant_id = $...` patterns. Super Admin may have null tenant scope for read; writes require explicit tenant.
- No PostgreSQL RLS policies exist in baseline; no `SET LOCAL`/`set_config` tenant context in app queries.

## 3. Role proposal

### 3.1 `spms_migrator` (deployment/migration only)
```sql
-- PROPOSED - REVIEW BEFORE RUNNING - STAGING ONLY AFTER APPROVAL
-- Run as Supabase admin/owner role in an approved SQL session.
CREATE ROLE spms_migrator LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION
  CONNECTION LIMIT 5
  PASSWORD '<managed-secret>'; -- store in secret manager, never commit/log
```

**Responsibilities/privileges (review against actual Supabase ownership):**
- `CONNECT` on target database.
- `USAGE, CREATE` on `public` schema (or ownership transfer model; see §5). If Supabase restricts public schema ownership, use an approved admin-owned migration path and grant only required DDL.
- Ability to create/alter tables/indexes/constraints/functions/sequences used by SPMS migrations.
- `INSERT, SELECT, UPDATE` on `public.schema_migrations` as needed by runner; runner inserts filename/checksum.
- No routine application data access beyond migration needs.

**Do not grant:** superuser, BYPASSRLS, CREATEROLE, CREATEDB, broad read/write to app data for normal runtime.

### 3.2 `spms_app` (Express runtime)
```sql
-- PROPOSED - REVIEW BEFORE RUNNING - STAGING ONLY AFTER APPROVAL
CREATE ROLE spms_app LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION
  CONNECTION LIMIT 20 -- align with pool max and Supabase limits
  PASSWORD '<managed-secret>';
```

**Responsibilities/privileges:**
- `CONNECT` on target database.
- `USAGE` on `public` schema.
- Table-by-table DML privileges per §4. No `CREATE`, no `ALTER`, no `DROP`, no `TRUNCATE`, no `REFERENCES` unless justified.
- `USAGE, SELECT` on sequences needed for inserts (identity/serial sequences). Prefer explicit grants after object creation.
- No BYPASSRLS. If RLS enabled later, `spms_app` must be subject to policies.

## 4. Table-by-table access audit (derived from route code inspection)

> Derived by grep of route SQL/table references; **must be validated against every route handler and query before applying grants**. `R`=SELECT, `I`=INSERT, `U`=UPDATE, `D`=DELETE. Least privilege: grant only required operations.

| Table | Routes / usage | Required DML (proposed) | Notes |
|---|---|---|---|
| `tenants` | auth, paymentRoutes, public, tenants | R, U (I only if registration creates tenant; verify) | Tenant onboarding/plan/status updates; protect sensitive columns |
| `tbl_users` | auth, orders, tenants, users | R, I, U, D? | Verify delete vs soft-disable; password hashes sensitive |
| `tbl_categories` | auth, categories, dashboard, products, public, reports, tenants | R, I, U, D | |
| `tbl_products` | categories, dashboard, orders, products, public, reports, services, stock, tenants, warranties | R, I, U, D | |
| `tbl_stock` | dashboard, orders, products, public, reports, stock, tenants | R, I, U | Stock adjustments/orders update quantities; verify delete |
| `tbl_stock_log` | orders, products, public, stock | R, I | Append/audit style; avoid UPDATE/DELETE for app |
| `tbl_customers` | customers, dashboard, orders, reports, services, tenants, warranties | R, I, U, D | |
| `tbl_suppliers` | dashboard, products, reports, suppliers, tenants | R, I, U, D | |
| `tbl_orders` | dashboard, orders, payment/public flows, reports, tenants | R, I, U | Status transitions; avoid hard delete unless route requires |
| `tbl_order_items` | dashboard, orders, public, tenants | R, I | Usually append with order; verify update/delete |
| `tbl_orders_details` | (check routes/migrations; legacy/compat) | R, I, U? | Confirm actual use before granting |
| `tbl_payment` | orders | R, I, U? | Confirm payment flow |
| `tbl_payment_method` | (check routes) | R, I, U, D? | Confirm usage |
| `tbl_held_sales` | (check routes) | R, I, U, D? | Confirm POS held-sale flow |
| `tbl_warranty` | tenants, warranties | R, I, U, D | |
| `tbl_service_requests` | services, tenants | R, I, U, D | |
| `tbl_activity_logs` | orders, paymentRoutes, tenants | R, I | Audit log; avoid UPDATE/DELETE for app |
| `store_settings` | auth, public | R, I, U | |
| `schema_migrations` | migration runner only | none for `spms_app` | `spms_migrator` only |

## 5. Ownership and default privileges
- **Must inspect actual remote owners/default privileges before applying.** Supabase-managed projects may have specific owner roles.
- Preferred: objects created by `spms_migrator` (or approved owner) with default privileges granting required DML to `spms_app`.
- Proposed pattern (review/adjust):
```sql
-- PROPOSED - REVIEW ACTUAL OWNER/SCHEMA
GRANT USAGE ON SCHEMA public TO spms_app;
GRANT USAGE ON SCHEMA public TO spms_migrator;
-- After migrations, grant table privileges explicitly:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO spms_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO spms_app;
-- Default privileges for future objects created by spms_migrator:
-- ALTER DEFAULT PRIVILEGES FOR ROLE spms_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spms_app;
-- ALTER DEFAULT PRIVILEGES FOR ROLE spms_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO spms_app;
```
- **Caveat**: default privileges apply only to objects created by the role specified in `FOR ROLE`. If Supabase dashboard/other role creates objects, defaults won't apply. Verify actual creator role.

## 6. Supabase-specific considerations
- `supabase_admin`, `postgres`, `service_role`, `authenticator`, `anon`, `authenticated` are Supabase-managed; do not modify/drop.
- Do not grant `spms_app` membership in Supabase service roles.
- Connection pooler usernames may be formatted differently (`role.projectref`); confirm exact runtime DSN format for chosen pooler mode.
- Review `PUBLIC` grants on schema/tables; revoke unnecessary PUBLIC privileges only with care and approval.

## 7. Verification queries (after approved staging apply)
```sql
-- Role attributes
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin, rolconnlimit
FROM pg_roles WHERE rolname IN ('spms_app','spms_migrator');

-- Table grants for spms_app
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee='spms_app' AND table_schema='public'
ORDER BY table_name, privilege_type;

-- No dangerous grants
SELECT * FROM information_schema.role_table_grants
WHERE grantee='spms_app' AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER');
```

## 8. Risks / open items
- Table-by-table audit is code-derived and must be validated against every handler, including dynamic SQL or future routes.
- Some tables may need narrower column privileges (e.g., `tbl_users` password hash/token fields) — requires app review.
- `spms_migrator` ownership/DDL on Supabase public schema needs live inventory confirmation.
- RLS (Option B) will require additional behavior: `spms_app` should not BYPASSRLS; policies must allow legitimate app operations. Option A relies on app scoping only.