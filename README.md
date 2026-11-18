# SPMS

Multi-tenant POS and inventory: Express + PostgreSQL API, React + Vite frontend.

## Quick start (local)

Requirements: Node 20+, npm, Docker (for the disposable test/dev databases).

```bash
npm run install:all   # install root, backend and frontend dependencies
npm run dev           # local dev DB (Docker, 127.0.0.1:15433), migrations, demo seed, backend + frontend
```

`npm run dev` works with **no `backend/.env` present** — test/dev-only defaults are
used for the local database. Never point the local workflow at a hosted database.

## Environment variables

Copy `.env.example` to your host's secret store / `.env` (never commit `.env`).
Key values:

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backend | Postgres connection; local dev/test URLs must stay on loopback |
| `JWT_SECRET` | backend | generate a random value; rotating it signs users out |
| `ADMIN_SECRET` | backend seed | sets the seeded super-admin password |
| `CORS_ORIGINS`, `FRONTEND_URL` | backend | comma-separated / single frontend origin |
| `VITE_API_URL` | frontend | backend API base, e.g. `http://localhost:5000/api` |
| `VITE_SENTRY_DSN` | frontend | optional error reporting |
| `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, `BAKONG_MERCHANT_CITY` | backend | BKQR payment merchant settings |

Stripe / SMTP entries in `.env.example` are placeholders — current subscription
payment is **Bakong KHQR with manual admin confirmation**: a QR is generated and a
super admin marks the session paid through the API. There is no mock or fake
payment flow. See `docs/OPERATIONS.md` for the settlement procedure.

## Checks

```bash
npm run verify        # test DB, jest, names gate, backend+frontend lint, build, audit, secret scan
npm run verify:full   # verify + mutation run + Playwright golden path + suite x3 (owner-run)
npm run test:e2e      # Playwright against a local e2e server (loopback only)
npm run names:diff    # review proposed test-name baseline changes
```

`npm run verify` exits 1 on any failed check. The full 5-step lean audit,
scorecard, raw output, and remaining risks are in `docs/ELON_5_STEP_AUDIT.md`.

## Deploy

- Backend deploys to Render (`render.yaml` is owner-controlled — do not edit it
  without approval); frontend deploys to Vercel. Set the variables above in the
  host's secret store, not in committed files.
- Before deploying: `npm run verify`. For schema changes, the owner rehearses on
  a scratch test DB with `npm run rehearse -- <schema-only-dump.sql>`.
- After deploying: monitor `GET /health` (200 + `"db":"connected"`).
- Rollback is by redeploying the previous tag — never by hand-editing files or
  dropping tables. See `docs/OPERATIONS.md`, `docs/RELEASE.md`, `docs/RESTORE.md`.

## Documentation

`docs/README.md` (API overview), `docs/PRODUCT.md`, `docs/ROUTES.md`,
`docs/SCHEMA_CONTRACT.md`, `docs/LIVE_SCHEMA.md`, `docs/OPERATIONS.md`,
`docs/RELEASE.md`, `docs/RESTORE.md`, `ADMIN_GUIDE.md`, `USER_GUIDE.md`.

Rules: Docker Postgres only; no production DB access from local scripts; no
committed secrets; tests may only be changed by the owner.
