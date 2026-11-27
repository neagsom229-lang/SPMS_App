# Staging Deployment Runbook — SPMS (PROPOSED)

> **Status: DRAFT / NOT APPROVED FOR EXECUTION.**  
> No remote staging or production changes have been made. This runbook is for an **isolated staging environment only** after explicit owner approval. Every step that touches a remote DB must be re-confirmed as approved before execution.

## 0. Stop conditions
Stop immediately if:
- Target is production or not clearly isolated staging.
- Read-only inventory is incomplete or shows unexpected objects/data.
- Secrets would be exposed in logs, command history, screenshots, or files.
- Any command requires `supabase db push/reset/migration up`, `--linked`, `--db-url` for non-read-only work, or remote SQL execution outside the approved path.
- SSL verification cannot be enabled.
- Role/grant/RLS SQL has not been reviewed.

## 1. Preconditions
- [ ] Owner approval for isolated staging target recorded.
- [ ] `docs/REMOTE_DATABASE_INVENTORY.md` completed with actual read-only results.
- [ ] Backup/restore/PITR point available for staging target.
- [ ] Secrets stored in approved secret manager/local secret storage (not `.env` committed, not printed).
- [ ] Chosen connection mode documented: **migrations via direct/session-compatible connection**; app runtime mode evaluated separately.
- [ ] `node --check backend/scripts/run_migration.js` and `npm run verify` pass on deploy commit.

## 2. Supabase project configuration (staging)
- Project: isolated staging Supabase project (not `SPMS_server` production unless explicitly approved as staging target — prefer separate project).
- PostgreSQL: 17.x compatibility target (production target is 17.12; staging should match major/minor where possible).
- Auth/network: restrict access to approved operators/IPs if possible; no public DB exposure beyond required Supabase endpoints.
- Connection strings: obtain direct/session connection string for migrations; session/transaction pooler evaluated for app runtime. Do not log full strings.

## 3. Secure TLS configuration
- App config: `backend/src/config/postgres.js` already enforces `rejectUnauthorized: true` for Supabase/cloud hosts.
- Set `DB_SSL_CA` to Supabase CA PEM/file path if needed. Never set `rejectUnauthorized=false`.
- Verify with a simple read-only query over TLS before migration: `SELECT current_user, version();`

## 4. Role creation (PROPOSED SQL — review before running)
```sql
-- PROPOSED - STAGING ONLY AFTER APPROVAL
CREATE ROLE spms_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 5 PASSWORD '<secret>';
CREATE ROLE spms_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 20 PASSWORD '<secret>';
GRANT CONNECT ON DATABASE <staging_db> TO spms_migrator, spms_app;
GRANT USAGE ON SCHEMA public TO spms_migrator, spms_app;
-- Additional DDL/grants per ROLE_AND_GRANTS_DESIGN.md after review.
```
Verification:
```sql
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname IN ('spms_app','spms_migrator');
```

## 5. Baseline application
- Use `database/baseline.sql` (generator-produced; do not hand-edit).
- Apply as approved migration/owner identity over direct/session connection.
- Baseline creates schema objects and `schema_migrations` table (filename, executed_at, checksum nullable).
- **Do not** include seed/demo data in staging unless explicitly approved and isolated.

Verification:
```sql
SELECT to_regclass('public.schema_migrations');
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
```

## 6. Migration ledger initialization (001-014 baseline-equivalent)
If baseline represents 001-014 state, mark 001-014 as applied in `schema_migrations` without re-running them. Checksums may be NULL for legacy rows (runner supports this with warning).

```sql
-- PROPOSED - review exact filenames against database/migrations/
INSERT INTO public.schema_migrations (filename) VALUES
('001_backfill_tenant_id.sql'),
('002_pos_and_stock_log.sql'),
('003_round2_hardening.sql'),
('004_round3_hardening.sql'),
('005_public_store_and_online_orders.sql'),
('006_align_to_live_schema.sql'),
('007_payment_method_held_sales.sql'),
('008_missing_columns.sql'),
('009_warranty_and_services.sql'),
('010_sync_product_stock.sql'),
('011_backfill_buy_price.sql'),
('012_backfill_store_settings.sql'),
('013_product_brand_model.sql'),
('014_orders_updated_at.sql')
ON CONFLICT (filename) DO NOTHING;
```

Verification:
```sql
SELECT filename, executed_at, checksum IS NOT NULL AS has_checksum FROM public.schema_migrations ORDER BY filename;
```

## 7. Migrations 015–030
- Run custom runner only: `backend/scripts/run_migration.js`.
- Use direct/session-compatible connection. Ensure `ALLOW_REMOTE_DB=1` is set deliberately only in approved staging environment (postgres.js guard). Do not log DATABASE_URL.
- Runner behavior: advisory lock, checksum record for new migrations, legacy checksum warnings, unknown ledger row hard fail, checksum mismatch hard fail, idempotency pass.

Execution (approved staging env only):
```powershell
# PROPOSED - DO NOT RUN WITHOUT APPROVAL
$env:SPMS_DB_MODE='staging' # or approved mode; ensure DATABASE_URL/guards align
$env:ALLOW_REMOTE_DB='1'    # only if approved
node backend/scripts/run_migration.js
```

Verification:
```sql
SELECT COUNT(*) AS migration_count FROM public.schema_migrations; -- expect 30
SELECT filename FROM public.schema_migrations ORDER BY filename;
```
Re-run runner once to confirm idempotency (PASS 2).

## 8. Application grants
- Apply table-by-table grants per `docs/ROLE_AND_GRANTS_DESIGN.md` after validating actual table/column usage.
- Grant sequence USAGE/SELECT for serial/identity sequences used by `spms_app`.
- Do not grant DDL/TRUNCATE/REFERENCES/TRIGGER/BYPASSRLS.

Verification: `information_schema.role_table_grants` for `spms_app`.

## 9. RLS configuration
- **Default for initial staging**: do not enable RLS until Option B refactor is complete and tested, unless owner explicitly approves Option A hardening-only milestone. Option A alone is **not DB-enforced tenant isolation**.
- If Option B is implemented later: enable RLS per table with table-specific policies; run negative two-tenant tests before accepting.

## 10. Default privileges
- Review `pg_default_acl` and object owners. Apply default privileges only for the actual role that creates future objects.
- Re-verify after any migration that creates new tables/sequences.

## 11. Health/readiness verification
- Backend env configured with staging `DATABASE_URL` (secret), `DB_SSL_CA` if needed, appropriate pool limits.
- `GET /health/live` => 200.
- `GET /health/ready` => 200 with DB connected; 503 on DB failure.
- Confirm graceful shutdown closes server and DB pool (SIGTERM).

## 12. Application smoke verification
- Auth login/logout, forced password change, tenant-scoped CRUD smoke, super-admin flows, public storefront, checkout/order flow.
- Run selected Playwright smoke against staging only if staging is seeded appropriately and isolated. Do not point tests at production.

## 13. Rollback strategy
| Scenario | Rollback |
|---|---|
| Before baseline | Drop staging DB objects / restore empty snapshot |
| After baseline/migrations | Restore staging snapshot/PITR; do not hand-edit ledger |
| App deploy issue | Redeploy previous app build; keep DB if backward compatible |
| Bad grant/RLS | Revoke/adjust in staging via reviewed SQL or restore snapshot |
| Data corruption | Restore PITR/snapshot; investigate before reapply |

## 14. Evidence to capture (redacted)
- Inventory query outputs (no secrets).
- Migration runner output (no connection strings).
- Ledger count and filenames.
- Role/grant verification queries.
- Health/readiness responses.
- Smoke/E2E results with timestamps and commit SHA.