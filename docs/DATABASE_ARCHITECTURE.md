# SPMS Database Architecture

## Scope
This document describes the **actual** SPMS database architecture as implemented in this repository. It is based on `database/schema.sql`, `database/baseline.sql`, migrations `001-030`, backend config/scripts, and runtime middleware.

## High-level architecture
- **Application**: Node.js/Express backend (`backend/src/app.js`) with PostgreSQL via `pg` pool (`backend/src/config/postgres.js`).
- **Auth**: Custom JWT (`backend/src/middleware/auth.js`), not Supabase Auth. JWT contains user identity; DB lookup enforces user status, tenant status, token version, and password-change requirement.
- **Tenancy model**: Multi-tenant, shared database/shared schema. Most business tables include `tenant_id` referencing `tenants(id)`. Tenant scope is enforced in application middleware/routes (`requireTenant/getScope`, role checks). Super Admin can operate cross-tenant with explicit tenant context for writes.
- **Database**: PostgreSQL. Local dev supports native PG18 (`spms_db`, role `spms_app`) or Docker dev container; tests use disposable Docker test DB. Production target is Supabase-hosted PostgreSQL (separate service from backend hosting).

## Authoritative schema/migration artifacts
- `database/schema.sql` — base inferred schema.
- `database/baseline.sql` — **generated** schema-only baseline from `schema.sql + migrations 001-014` (PG 17.11 dump, `--no-owner`, no data). Do not hand-edit; regenerate only via `node backend/scripts/make-baseline.js`.
- `database/migrations/001..030` — ordered SQL migrations; custom runner ledger is `public.schema_migrations(filename PK, executed_at)`.
- `backend/scripts/run_migration.js` — authoritative migration runner.
- `backend/scripts/test-db.js` — canonical test build: load baseline, mark 001-014, run 015+ through real runner.
- `backend/scripts/rehearse.js` — owner-run rehearsal against schema-only dump.

## Core tables (from baseline/migrations)
| Table | Purpose | Tenant scoped | Key notes |
|---|---|---:|---|
| `tenants` | Tenant/business records | n/a (root) | plan/status/expiry/admin columns added by migrations |
| `tbl_users` | Application users | yes (nullable for super admin) | JWT auth, roles, `token_version`, `must_change_password` |
| `tbl_categories` | Product categories | yes | |
| `tbl_products` | Products | yes | price/cost/stock/barcode/image/publish fields |
| `tbl_stock` | Stock quantities per product | yes | synced/updated by app+triggers/migrations |
| `tbl_stock_log` | Stock movement audit | yes | type/reference/notes fields evolved by migrations |
| `tbl_customers` | Customers | yes | |
| `tbl_suppliers` | Suppliers | yes | |
| `tbl_orders` | Orders/sales | yes | order_no, status, payment, source, idempotency/tracking fields |
| `tbl_order_items` | Order line items | yes | qty/unit_price/subtotal/refund fields |
| `tbl_payment` | Payment records | yes | status constrained by migrations |
| `tbl_payment_method` | Tenant payment methods | yes | RLS enabled in baseline |
| `tbl_held_sales` | POS held sales | yes | RLS enabled in baseline |
| `tbl_warranty` | Warranty records | yes | RLS enabled in baseline |
| `tbl_service_requests` | Service/warranty requests | yes | RLS enabled in baseline |
| `store_settings` | Public store/tenant settings | yes | slug/opening hours/config |
| `tbl_activity_logs` | Audit/activity log | yes | user FK set null by migration 030 |
| `khqr_sessions` | KHQR/subscription payment sessions | yes | evolved across 018/023/026; manual confirmation flow |
| `khqr_webhook_events` | Webhook idempotency ledger | n/a | created by 023 replay path; RLS enabled there |
| `tenant_order_counters` | Per-tenant order numbering | yes | added by 017 |
| `schema_migrations` | Custom migration ledger | n/a | authoritative runner ledger |

## Relationships / integrity (representative)
- `tbl_users.tenant_id -> tenants.id`
- `tbl_products.category_id -> tbl_categories.id`
- `tbl_orders.customer_id -> tbl_customers.id`, `tbl_orders.user_id -> tbl_users.userid`
- `tbl_order_items.order_id -> tbl_orders.or_id`, `product_id -> tbl_products.id`
- `tbl_stock.productid -> tbl_products.id`
- `tbl_activity_logs.user_id -> tbl_users.userid` (ON DELETE SET NULL by 030)
- `khqr_sessions.tenant_id/user_id` FKs added/reconciled in 023.

Always confirm exact constraints from baseline+migrations before changing schema.

## RLS status
- Baseline enables RLS on 4 tables: `tbl_held_sales`, `tbl_payment_method`, `tbl_service_requests`, `tbl_warranty`.
- Migration 022 enables RLS on **all public tables** and revokes table/sequence privileges from `anon`/`authenticated` (if roles exist).
- Migration 025 revokes default privileges in `public` from `anon`/`authenticated`.
- **No tenant RLS policies are defined in migrations.** The app does not set `current_setting('app.tenant_id', ...)`. Tenant isolation is currently enforced by application logic.

## Deployment split
- **Backend**: Node/Express hosted on app platform (Render currently configured in `render.yaml`, owner-controlled).
- **Database**: Hosted PostgreSQL on Supabase (target project `SPMS_server`, ref `ocdmrxtbvsepmkrweetd`, Seoul, PG 17.12 as previously reported). These are separate services. Frontend is separate (Vercel per README).

## Known architecture constraints
- `deploy-db.ps1` is hardcoded for 026/028 only; not a general migration deployer.
- `_guard.js` prevents unsafe local/test/dev DB targets; remote production deploy needs an approved, explicit safe wrapper.
- PG 18.7 local vs Supabase PG 17.12 requires compatibility verification before remote init/data restore.