# Remote Database Inventory — SPMS_server (Phase E)

> **Status: INCOMPLETE / OWNER-RUN READ-ONLY INSPECTION REQUIRED.**  
> No remote DDL/DML/role/RLS/grant/import/reset executed. This report records only previously owner-reported evidence and local-repo-derived expectations. Any unknown field is marked `UNKNOWN - requires read-only inspection`.

## Target
| Field | Value | Evidence |
|---|---|---|
| Project name | SPMS_server | Owner-provided / checkpoint |
| Project ref | `ocdmrxtbvsepmkrweetd` | Owner-provided / checkpoint |
| Region | Seoul | Checkpoint |
| PostgreSQL | 17.12 | Owner-reported read-only verification |
| Inspection identity (prior) | `supabase_read_only_user` / `postgres` (owner-reported command) | Checkpoint |
| Inspection mode required | Explicit read-only only (`--read-only --remote=ocdmrxtbvsepmkrweetd` where CLI used) | AGENTS.md / Phase E constraints |

## Prior owner-reported findings (not re-verified in this session)
| Check | Prior finding | Confidence | Re-verify |
|---|---|---:|---|
| Public policy count | `0` | Owner-reported | Re-run read-only policy query |
| `public.schema_migrations` | `NULL` / absent per catalog query | Owner-reported | Re-run table/catalog query |
| Public table rows returned by catalog query | No rows returned | Owner-reported | Re-run with explicit catalog query; distinguish empty vs query scope |
| `spms_app` role | Absent from inspected role results | Owner-reported | `pg_roles` query |
| `spms_migrator` role | Absent from inspected role results | Owner-reported | `pg_roles` query |

## What must NOT be assumed
- **Do not assume the entire database is empty** because `public.schema_migrations` is missing/null or public table rows were not returned. Supabase projects contain system schemas (`auth`, `storage`, `realtime`, `extensions`, `vault`, `graphql`, `graphql_public`, `pgbouncer` etc.), extensions, and Supabase-managed objects.
- **Do not assume public schema ownership/grants are safe for app runtime** without inspecting actual owners, default privileges, and grants.
- **Do not assume absence of data** without table-by-table counts on relevant application tables.

## Required read-only inspection queries (owner/approved operator to run)

> Run only via approved read-only path. Do not paste secrets into logs. Replace placeholders; do not expose connection strings.

### 1) Server/identity
```sql
SELECT current_database() AS db, current_user AS usr, session_user AS session_usr,
       version() AS pg_version, inet_server_addr()::text AS server_addr, inet_server_port() AS server_port;
SHOW server_version;
```

### 2) Schemas (non-system and system awareness)
```sql
SELECT nspname, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
ORDER BY nspname;
```

### 3) Extensions
```sql
SELECT e.extname, e.extversion, n.nspname AS schema, pg_get_userbyid(e.extowner) AS owner
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;
```

### 4) Roles/memberships (no passwords)
```sql
SELECT r.rolname, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolcanlogin,
       r.rolbypassrls, r.rolreplication, r.rolconnlimit, r.rolvaliduntil
FROM pg_roles r ORDER BY r.rolname;

SELECT pg_get_userbyid(m.roleid) AS member, pg_get_userbyid(m.member) AS granted_to,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m ORDER BY 1,2;
```

### 5) Public tables/objects
```sql
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_type, table_name;

SELECT n.nspname AS schema, c.relname AS name, c.relkind, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relkind, c.relname;
```

### 6) RLS policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 7) Grants / default privileges
```sql
SELECT grantee, table_schema, table_name, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY grantee, table_name, privilege_type;

SELECT pg_get_userbyid(d.defaclrole) AS object_owner,
       n.nspname AS schema,
       d.defaclobjtype AS object_type,
       pg_catalog.array_to_string(d.defaclacl, E'\n') AS default_acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY 1,2,3;
```

### 8) Migration ledger / app tables presence
```sql
SELECT to_regclass('public.schema_migrations') AS schema_migrations,
       to_regclass('public.tenants') AS tenants,
       to_regclass('public.tbl_users') AS tbl_users,
       to_regclass('public.tbl_products') AS tbl_products,
       to_regclass('public.tbl_orders') AS tbl_orders;

-- Only if schema_migrations exists:
-- SELECT filename, executed_at, checksum IS NOT NULL AS has_checksum
-- FROM public.schema_migrations ORDER BY filename;
```

### 9) Table row counts (only after confirming tables exist; read-only)
```sql
-- Generate and review before running; do not run blindly on unknown schemas.
SELECT relname AS table_name, n_live_tup AS est_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
```

## Expected SPMS application objects (from local baseline/migrations)
If staging/prod is initialized by the SPMS custom path, expect public-schema objects including: `schema_migrations`, `tenants`, `tbl_users`, `tbl_categories`, `tbl_products`, `tbl_stock`, `tbl_stock_log`, `tbl_customers`, `tbl_suppliers`, `tbl_orders`, `tbl_order_items`, `tbl_orders_details`, `tbl_payment`, `tbl_payment_method`, `tbl_held_sales`, `tbl_warranty`, `tbl_service_requests`, `tbl_activity_logs`, `store_settings`, plus indexes/constraints/FKs from `database/baseline.sql` and migrations 015-030. **Do not create or alter these remotely without approved staging/production runbook.**

## Inventory gaps
| Gap | Impact | Owner action |
|---|---|---|
| No live read-only CLI/DB session in this agent session | Cannot confirm current remote state | Run queries above via approved read-only access; paste redacted results |
| Supabase-managed schemas/extensions not inspected | Role/grant/default-privilege decisions may conflict | Inspect all non-pg_catalog schemas and extension owners |
| Actual object owners/default privileges unknown | `spms_migrator`/`spms_app` grants may be ineffective | Inspect default ACLs and table owners |
| Existing data unknown | Baseline/migration safety unknown | Get exact counts and confirm empty/staging-only before any init |

## Conclusion
Remote inventory is **INCOMPLETE**. Prior owner-reported signals suggest public app schema may be uninitialized, but that is **not sufficient** to declare the remote DB empty or safe for initialization. A full read-only inventory is required before any staging/prod role creation, baseline apply, migration, grant, or RLS change.