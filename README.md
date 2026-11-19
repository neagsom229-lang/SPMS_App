# SPMS

Multi-tenant POS and inventory: Express + PostgreSQL API, React + Vite frontend.

## Quick start (native PostgreSQL on Windows)

Requirements: Node 20+, npm, and PostgreSQL 18 listening on `127.0.0.1:5432`.
Docker Desktop is only needed for `npm run verify` / `npm run test:e2e`, which
use their own disposable test database; the dev database never uses Docker in
local mode.

One-time setup:

1. As the `postgres` superuser, run `database/local/001_app_role.sql`. Replace
   its password placeholder (or set the password interactively with
   `\password spms_app`). It creates the least-privilege login role `spms_app`,
   makes it own `spms_db`, and adds `NOLOGIN` placeholders for the `anon` /
   `authenticated` names used by historical migrations 022/025. The app never
   connects as `postgres`.
2. Copy the env templates and fill in the local password (never commit `.env`):
   `backend/.env.example` → `backend/.env`,
   `frontend/.env.example` → `frontend/.env`.
3. `npm run install:all`
4. `npm run dev`

`npm run dev` runs preflight → migrate → seed → backend + frontend in one
command. Preflight fails with a Windows-friendly message when PostgreSQL is not
running, the password is wrong, or `spms_db` does not exist.

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5000` (`/health` returns `{"status":"healthy","db":"connected"}`)
- Demo login (seeded once, local only): `demo_admin` / `Demo1234!`; the full
  credential list is printed on the first seed.

Useful local commands:

```bash
npm run db:dev:preflight   # check PostgreSQL, database and app role
npm run db:dev:migrate     # baseline an empty DB, then run pending migrations
npm run db:dev:seed        # idempotent demo shop seed
npm run smoke:local        # /health, login, list routes, CRUD against the dev DB
npm run db:reset:local     # drops ONLY the public schema of spms_db, then rebuilds
```

`db:reset:local` requires typing the confirmation phrase and never drops the
database or the role.

Without `backend/.env` (or with `DEV_DB_MODE=docker`), `npm run dev` falls back
to the historical Docker dev container `spms_dev` on `127.0.0.1:15433`. The test
database (`spms_test`, port 15432) is always the Docker container from
`docker-compose.test.yml`; it is separate from both dev modes.

## Environment variables

Copy the templates in `backend/` and `frontend/`; production secrets belong in
the host's secret store, never in a committed file.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backend | Postgres connection; local dev URLs must stay on loopback |
| `DEV_DB_MODE` | dev scripts | `local` = native PostgreSQL, anything else = Docker dev container |
| `DEV_DB_PORT`, `DEV_DB_NAME` | dev scripts | defaults `5432` / `spms_db` in local mode, `15433` / `spms_dev` in Docker mode |
| `TEST_DB_PORT` | jest / Playwright | disposable test container, default `15432` |
| `DB_POOL_MAX` | backend | pool size, integer 1–50, default `10` |
| `JWT_SECRET` | backend | generate a random value; rotating it signs users out |
| `CORS_ORIGINS`, `FRONTEND_URL` | backend | comma-separated / single frontend origin |
| `DB_SSL_CA` | backend | optional PEM text or path for a private CA; verification stays on |
| `VITE_API_URL` | frontend | backend API base, e.g. `http://127.0.0.1:5000/api` |
| `VITE_SENTRY_DSN` | frontend | optional error reporting |
| `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, `BAKONG_MERCHANT_CITY` | backend | Bakong KHQR merchant settings |

Stripe / SMTP entries are placeholders — current subscription payment is
**Bakong KHQR with manual admin confirmation**: a QR is generated and a super
admin marks the session paid through the API. There is no mock or fake payment
flow. See `docs/OPERATIONS.md` for the settlement procedure.

## Checks

```bash
npm run verify        # test DB, jest, names gate, backend+frontend lint, build, audit, secret scan
npm run verify:full   # verify + mutation run + Playwright golden path + suite x3 (owner-run)
npm run test:e2e      # Playwright against a local e2e server (loopback only)
npm run names:diff    # review proposed test-name baseline changes
```

`npm run verify` exits 1 on any failed check. Playwright serves the e2e backend
on `127.0.0.1:5055` (not 5050, which is pgAdmin 4's default) and the built
frontend on `127.0.0.1:4173`; override with `E2E_BACKEND_PORT` /
`E2E_FRONTEND_PORT` if needed. The full 5-step lean audit, scorecard, raw
output, and remaining risks are in `docs/ELON_5_STEP_AUDIT.md`.

## Deploy

- Production uses a hosted PostgreSQL reached through `DATABASE_URL` in the
  Render environment variables (Supabase, Neon, or another provider). Never put
  the connection string in git. `NODE_ENV=production` enables TLS with
  certificate verification; if the provider uses a private CA, set `DB_SSL_CA`
  to the PEM text or a PEM file path. Leave `DB_SSL` unset in production.
- Backend deploys to Render (`render.yaml` is owner-controlled — do not edit it
  without approval); frontend deploys to Vercel. Set the variables above in the
  host's secret store, not in committed files.
- Before deploying: `npm run verify` and `npm run test:e2e`. For schema changes,
  apply pending migrations with `npm run db:deploy` after rehearsing them with
  `npm run rehearse -- <schema-only-dump.sql>`.
- After deploying: monitor `GET /health` (200 + `"db":"connected"`).
- Rollback is by redeploying the previous tag — never by hand-editing files or
  dropping tables. See `docs/OPERATIONS.md`, `docs/RELEASE.md`, `docs/RESTORE.md`.

## Documentation

`docs/README.md` (API overview), `docs/PRODUCT.md`, `docs/ROUTES.md`,
`docs/SCHEMA_CONTRACT.md`, `docs/LIVE_SCHEMA.md`, `docs/OPERATIONS.md`,
`docs/RELEASE.md`, `docs/RESTORE.md`, `ADMIN_GUIDE.md`, `USER_GUIDE.md`.

Rules: no production DB access from local scripts; no committed secrets; the
test database stays separate from the dev database; tests may only be changed
by the owner.
