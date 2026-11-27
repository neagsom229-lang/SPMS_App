# SPMS Deployment Guide

## Scope
This guide prepares the existing SPMS backend for deployment with Supabase-hosted PostgreSQL. Backend hosting and Supabase DB hosting are **separate services**. No remote DB changes are performed by this guide.

## 1. Pre-deploy checks (local, safe)
Run in PowerShell from repo root:

```powershell
npm run verify
npm run test:e2e
```

For schema changes, rehearse against a schema-only dump (owner-run, local test container):

```powershell
npm run rehearse -- D:\path\to\schema-only-dump.sql
```

## 2. Backend configuration
Set these in the hosting platform secret store (Render/VPS/container/etc.), not in git:

| Name | Example/Note |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | platform-provided or `5000` |
| `DATABASE_URL` | Supabase/Postgres connection string from Supabase Dashboard (secret) |
| `JWT_SECRET` | strong random secret |
| `CORS_ORIGINS` | `https://your-frontend.example` (comma-separated exact origins) |
| `FRONTEND_URL` | `https://your-frontend.example` |
| `DB_POOL_MAX` | `10` or appropriate for pooler limits |
| `DB_SSL_CA` | only if provider uses private CA; PEM text or file path |

## 3. Backend startup
- Build/install: `npm install --prefix backend`
- Start: `npm start` (runs `node src/app.js` in backend)
- Health checks: `GET /health/live` (process liveness), `GET /health/ready` (DB readiness, `SELECT 1`), `GET /health` (backward-compatible).
- Render currently uses `/health` in `render.yaml` (owner-controlled). Consider `/health/ready` only after confirming platform behavior.

## 4. Supabase DB preparation (requires explicit approval)
Before any remote DDL:
1. Install/verify Supabase CLI v3; authenticate via browser; `supabase projects list`.
2. Link only intended ref: `ocdmrxtbvsepmkrweetd`.
3. Read-only remote inspection: PG version/extensions/roles/schemas/tables/migration history.
4. Produce approval packet: exact SQL order, objects/permissions, security plan, backup/restore, dry-run, risks.
5. Get explicit owner approval.

**Do not run:** `supabase db push`, `supabase db reset`, `supabase migration up`, or remote custom runner without approval.

## 5. Migration deployment (approved path only)
Canonical system: `database/baseline.sql` + `database/migrations/001-030` via custom runner `backend/scripts/run_migration.js` and `public.schema_migrations` ledger.

Fresh empty DB plan (draft): baseline -> mark 001-014 -> run 015-030 -> idempotency pass -> verify. A safe remote wrapper script must be reviewed before use because `_guard.js` blocks unsafe targets by design.

## 6. Post-deploy verification
- `GET /health/live` returns 200.
- `GET /health/ready` returns 200 with DB connected.
- Auth login works; tenant-scoped endpoints return correct data; Super Admin scope behaves correctly.
- No secrets in logs.
- Monitor logs and DB connection pool saturation.

## 7. Rollback
- **Code:** redeploy previous git tag.
- **DB:** prefer forward-only additive migrations. For initialization, restore from approved backup/snapshot. Never drop/truncate production data as rollback without approved plan.