# SPMS Database Setup

## Purpose
This guide covers local development database setup and the **preparation** steps for a Supabase-hosted PostgreSQL production database. It does **not** authorize remote schema changes.

## Local development (native PostgreSQL, default)
- Requirements: Node 20+, PostgreSQL 18 on `127.0.0.1:5432`.
- One-time role/db provisioning (run as postgres superuser): `database/local/001_app_role.sql`.
- Copy env templates: `backend/.env.example` -> `backend/.env`, `frontend/.env.example` -> `frontend/.env`.
- Set `DATABASE_URL` in `backend/.env` to the local `spms_app` connection (never commit it).
- Start: `npm run dev` (preflight -> migrate -> seed -> backend+frontend).

## Local test database (Docker, disposable)
- Used by `npm run verify` / `npm run test:e2e`.
- Container: `spms_test_db`, port `15432` (or `TEST_DB_PORT`), DB `spms_test`.
- Built from `database/baseline.sql` + migrations 015+ by `backend/scripts/test-db.js`.

## Environment variables (backend)
Use placeholders in docs; real values go in host secret store / local uncommitted `.env`.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | yes | Primary PostgreSQL connection string. For Supabase, obtain from Supabase project database settings; prefer the appropriate connection method for a long-running Node backend. |
| `JWT_SECRET` | yes | JWT signing secret; rotate carefully (invalidates sessions). |
| `CORS_ORIGINS` | prod yes | Comma-separated exact frontend origins. |
| `FRONTEND_URL` | optional | Primary frontend URL. |
| `PORT` | optional | Backend listen port; hosting platforms often inject it. |
| `NODE_ENV` | optional | `development`/`test`/`production`. |
| `DB_POOL_MAX` | optional | Pool size 1-50, default 10. |
| `DB_SSL_CA` | optional | PEM text or path to PEM file for private CA; TLS verification remains enabled. |
| `DB_SSL` | optional | In production, SSL defaults on for non-local/cloud hosts; `DB_SSL=false` only for explicit local production-like smoke tests. |
| `BAKONG_*` | feature-specific | Bakong/KHQR settings if used. |

## Supabase PostgreSQL connection notes
- Supabase project: **SPMS_server** (`ocdmrxtbvsepmkrweetd`, Seoul, PG 17.12 previously verified). Do not assume local repo is linked.
- Obtain connection details from Supabase Dashboard > Project Settings > Database. Use secrets manager/env vars; never commit.
- For long-running Node.js backends, use the Supabase connection method recommended for persistent servers/poolers and ensure SSL is enabled. Verify the exact host/port/user format in Dashboard/CLI docs for the installed CLI version.
- `backend/src/config/postgres.js` already: enforces TLS with `rejectUnauthorized:true` for Supabase/production-cloud hosts, supports `DB_SSL_CA`, sets pool limits/timeouts/keepalive, and blocks accidental remote connections unless explicitly allowed (`RENDER=true`/`ALLOW_REMOTE_DB=1` or local host).
- **Do not** disable SSL verification. **Do not** use postgres superuser as normal app role.

## Pre-remote-initialization checklist (approval required before any remote DDL)
1. Verify Supabase CLI version and project identity (`projects list`, link intended ref only).
2. Read-only remote inspection: PG version, extensions, roles, schemas, migration history, existing objects.
3. Confirm canonical migration plan (custom runner, `schema_migrations`, baseline+001-014 ledger+015-030).
4. Rehearse on PG 17.12-equivalent target.
5. Prepare backup/restore plan and approval packet.
6. Get explicit owner approval before any remote migration/role/RLS change.