# Phase E — Staging Deployment Preparation Plan

> **Status: STAGING PREPARATION IN PROGRESS / NO REMOTE CHANGES MADE.**  
> This document prepares an isolated staging deployment path. It does **not** authorize or perform staging/production DB changes, role creation, grants, RLS, imports, resets, or deployments.

## 1. Scope and guardrails
- Target remote project: `SPMS_server` (`ocdmrxtbvsepmkrweetd`, Seoul, PostgreSQL 17.12) — **read-only inventory only until separately approved**.
- No remote DDL/DML/role/RLS/grant/import/reset. No `supabase db push/reset/migration up`. No `--linked`, `--db-url`, or `--remote` except explicit read-only inspection.
- Custom migration system is authoritative: `database/baseline.sql` + `database/migrations/001-030` + `backend/scripts/run_migration.js`. **Do not introduce `supabase/migrations` as a second system.**
- Migrations 001-030 immutable; 015-026 treated as possibly applied. New changes go in new additive idempotent migrations.
- No secrets in logs/output. No `.env` read/edit/print. No SSL verification bypass. No `postgres`/`service_role` as normal Express runtime.

## 2. Current local acceptance evidence
| Gate | Result | Evidence |
|---|---:|---|
| Playwright E2E | PASS | `npm run test:e2e`: 74 passed, 0 failed, 0 skipped (4.1m), local e2e server/test DB |
| Jest | PASS | 25 suites / 223 tests |
| `npm run verify` | PASS | 138.0s, all 7 checks passed |
| Lint/build/audit/gitleaks | PASS | backend+frontend lint 0, Vite build pass, no high/critical prod advisories, gitleaks no leaks |
| Baseline equivalence | PASS | Local PG17 rehearsal: Build A/B 586 matching signatures, no diffs |
| Remote staging/prod | NOT TESTED | No remote changes/connections executed |

## 3. Staging environment prerequisites (before any remote action)
1. **Owner approval** for an isolated staging Supabase project (preferred) or an explicitly approved isolated schema/database target. Do not reuse production.
2. **Read-only remote inventory** completed and reviewed (`docs/REMOTE_DATABASE_INVENTORY.md`).
3. **Secret handling**: staging `DATABASE_URL`, JWT secrets, CA material, and role passwords stored in approved secret manager / local secret storage; never committed, never printed.
4. **Connection identity**: separate `spms_app` (runtime) and `spms_migrator` (migrations). No superuser/BYPASSRLS/CREATEROLE/CREATEDB for app runtime.
5. **TLS**: `rejectUnauthorized: true`; supply CA via `DB_SSL_CA` if chain not in Node root store. No SSL bypass.
6. **Rollback owner**: named owner with Supabase project restore/PITR authority and tested access.

## 4. Deployment package order (proposed, staging only after approval)

| Step | Action | Owner | Verification | Rollback |
|---:|---|---|---|---|
| E4.1 | Confirm isolated staging target and read-only inventory | Owner/DBA | Inventory report complete; target is not production | Stop |
| E4.2 | Configure Supabase project settings (PG17.12, connection mode, network restrictions as applicable) | Owner/DevOps | Settings recorded; no secrets in docs | Revert settings |
| E4.3 | Create `spms_migrator` and `spms_app` roles (reviewed SQL) | DBA/Owner | Role attributes/grants match design | `REVOKE`/`DROP ROLE` only if unused and approved |
| E4.4 | Apply `database/baseline.sql` as `spms_migrator`/owner-approved migration identity | DBA | Object counts/signatures match expected; no data | Restore staging snapshot/PITR |
| E4.5 | Initialize `schema_migrations` for 001-014 (baseline-equivalent) | DBA | 14 ledger rows present; checksums null acceptable for legacy | Restore/snapshot |
| E4.6 | Run `backend/scripts/run_migration.js` for 015-030 with `SPMS_DB_MODE`/approved env | DBA | 30 ledger rows; runner PASS; idempotency pass PASS | Restore/snapshot; do not manually edit ledger |
| E4.7 | Apply reviewed grants/default privileges for `spms_app` | DBA | Table-by-table grant audit passes; app can only do required DML | Revoke grants |
| E4.8 | Apply reviewed RLS (only after Option B refactor or explicitly accepted Option A) | DBA/App | RLS enabled/policies present; negative cross-tenant tests pass | Disable/adjust policies only in staging with approval; prefer restore |
| E4.9 | Configure Express staging env (`DATABASE_URL` to staging, TLS, pool limits, JWT/CORS/rate limits) | DevOps | `/health/live`, `/health/ready` 200; app starts; no secret logs | Revert env |
| E4.10 | Run smoke/E2E against staging | QA/Dev | Selected smoke + auth/tenant/isolation checks pass | Fix forward or restore |
| E4.11 | Production approval packet review | Owner | All gates green; residual risks accepted | Do not deploy |

## 5. Connection mode and advisory lock compatibility
- `backend/scripts/run_migration.js` uses a **session-level PostgreSQL advisory lock** (`pg_advisory_lock($1)`) on a dedicated client held for the duration of migration passes, then `pg_advisory_unlock` in `finally`.
- **Direct connection / session mode**: compatible, because the same session holds the lock.
- **Transaction pooling / pooler modes that do not preserve session affinity**: **not compatible** for this lock pattern. A lock acquired on one pooled server connection may not be released on the same session, or may be invisible across pooled commands.
- **Supabase recommendation for migrations**: use a direct/session-compatible connection for migration execution. For the application runtime, session pooler may be acceptable if validated; transaction pooler requires careful review (prepared statements, session GUCs, advisory locks, SET LOCAL behavior).
- **Action**: before staging, confirm exact Supabase connection string type for `spms_migrator` (direct/session) and `spms_app` (session/transaction evaluated). Document the chosen mode in runbook.

## 6. TLS / SSL
- `backend/src/config/postgres.js` enforces `rejectUnauthorized: true` for cloud/Supabase hosts. No SSL bypass.
- `DB_SSL_CA` supports PEM text or file path. Use Supabase CA if required by environment/runtime trust store.
- Staging verification must include a real TLS connection with verification enabled; do not use `sslmode=disable` or `rejectUnauthorized=false`.

## 7. Migration runner hardening status
Local changes (uncommitted, reviewed by diff):
- Fixed advisory lock key + dedicated lock client.
- `MIGRATION_LOCK_TIMEOUT_MS` (default 30000ms) to avoid indefinite waits.
- `schema_migrations.checksum` added; checksums recorded for newly applied migrations.
- Legacy rows without checksum: warned, not reconstructed.
- Checksum mismatch on applied migration: hard fail (immutability guard).
- Unknown ledger rows not present on disk: hard fail.
- Idempotency pass (PASS 2) retained.

Risks/notes:
- Legacy 001-014 have no checksums in existing ledgers; checksum enforcement applies to rows with checksums and newly applied rows.
- Runner assumes direct/session-compatible DB connection for advisory lock.
- `run_migration.js` loads `backend/src/config/postgres.js`, which currently exits if `DATABASE_URL` is non-local unless `ALLOW_REMOTE_DB=1` or `RENDER=true`. For staging remote use, this guard must be explicitly and deliberately set in the approved environment; document and audit this.

## 8. Verification queries (staging, read-only after apply)
```sql
-- Ledger
SELECT COUNT(*) AS migration_count FROM public.schema_migrations;
SELECT filename, checksum IS NOT NULL AS has_checksum FROM public.schema_migrations ORDER BY filename;

-- Object presence
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

-- Role sanity (no secrets)
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname IN ('spms_app','spms_migrator');
```

## 9. Rollback strategy
- **Preferred**: staging snapshot/PITR/restore point before E4.4. For production, mandatory backup/restore plan and owner-approved window.
- **Do not** "fix" migration history by editing applied migration files or deleting ledger rows ad hoc.
- **App rollback**: redeploy previous backend/frontend build; DB rollback only if backward compatible or restore performed.
- **RLS rollback**: staging only, via reviewed SQL or restore; never disable RLS silently in production.

## 10. Exit criteria for "Staging preparation complete"
- Remote inventory complete and reviewed.
- Role/grant/RLS design reviewed against actual route/table access.
- Staging runbook approved.
- Staging Supabase target approved and isolated.
- Migration runner connection-mode compatibility confirmed.
- No remote changes made before approval.

## 11. Current classification
- Local acceptance: **PASSED**.
- Staging preparation: **INCOMPLETE** (docs drafted; remote inventory and approvals pending).
- Staging deployment verified: **NOT TESTED**.
- Production deployment approved: **NOT APPROVED**.