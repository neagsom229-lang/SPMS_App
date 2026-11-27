# DEPLOY_CHECKLIST.md

Owner-run only. This is a checklist, not an automated deploy; `render.yaml` and
other deploy config are owner-controlled and are not changed here.

For **local** development (native PostgreSQL 18, `DEV_DB_MODE=local`, database
`spms_db`, role `spms_app`), the one-time provisioning script is
`database/local/001_app_role.sql`; `npm run dev` then runs preflight → migrate →
seed → both servers. `npm run db:reset:local` drops only the `public` schema of
`spms_db` after a typed confirmation. The sections below are for production.

## 1. Environment variables

Set these in the host secret store (never in a committed file).

Backend — required by `checkEnv()`:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | hosted PostgreSQL connection (Supabase, Neon, or another provider); production port 5432 |
| `JWT_SECRET` | random value; rotating it signs every user out |
| `CORS_ORIGINS` | comma-separated production frontend origin(s); **required when `NODE_ENV=production`** |
| `DB_SSL_CA` | optional: PEM text or a path to a PEM file when the provider uses a private CA |

Backend — Render sets these (`render.yaml`): `NODE_ENV=production`, `PORT=5000`.
Do not override them by hand.

Backend — operational:

- `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, `BAKONG_MERCHANT_CITY` — KHQR merchant settings.
- `FRONTEND_URL` — single frontend origin, used for redirects/links.
- `PLANS_CONFIRMED` — owner sets to `true` **only after confirming prices**; without it,
  production subscription QR creation returns HTTP 503. It is intentionally absent from
  `render.yaml`.
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `SMTP_USER`, `SMTP_PASS` — placeholders
  in `.env.example`; current payments are Bakong KHQR with manual admin confirmation.

Frontend (Vercel): `VITE_API_URL` (backend API base, e.g. `https://<host>/api`),
optional `VITE_SENTRY_DSN`.

### TLS in production

`NODE_ENV=production` enables TLS with `rejectUnauthorized: true` by default.
Leave `DB_SSL` unset: setting `DB_SSL=false` disables certificate verification
and is only for local production-like smoke tests against a loopback database.
Never weaken `rejectUnauthorized` in production.

### Optional DB_SSL_CA (private CA)

Hosted providers with a publicly trusted chain (including Supabase) need no CA
variable. If the deploy environment uses a private CA or a TLS-inspecting proxy,
supply the CA with `DB_SSL_CA` — either the PEM text or a path to a PEM file.
`postgres.js` adds it as `ssl.ca` while keeping `rejectUnauthorized: true`; it
never downgrades verification. An unreadable file path fails startup rather
than silently skipping verification.

`NODE_EXTRA_CA_CERTS` remains a valid alternative for a system-wide CA bundle.

## 2. Migrations and seed

- The backend does **not** run migrations on start (`startCommand: node src/app.js`).
- Apply every migration not yet recorded in `schema_migrations`, in filename
  order, with the owner-run deploy script: `npm run db:deploy` (see
  `docs/RELEASE.md` for the live ledger state — do not assume the local ledger
  matches production). Migrations are additive and idempotent and recorded in
  the migration ledger. `029_tenant_list_indexes.sql` is additive indexes only.
- Rehearse any schema change first on a scratch test DB:
  `npm run rehearse -- <schema-only-dump.sql>`.
- **Do not run `npm run seed` against production.** `backend/scripts/_guard.js`
  refuses any database that is not the local loopback test/dev DB.
  `backend/scripts/seed-demo.js` creates the local demo shop only; its printed
  `demo_*` credentials are demo-only, not production credentials.

## 3. Create the first super-admin

- There is no self-service super-admin creation. `POST /api/auth/register` requires an
  existing super-admin token and creates a tenant `Admin`, not a super admin.
- On a fresh production DB, the owner creates the first super-admin directly on the
  production database (the local seed cannot reach it): generate a bcrypt hash locally
  with `bcryptjs` (cost 10), keep the password only in the secret store, then insert a
  row into `tbl_users` with `username`, `email`, `password` (the hash), `role = 'Super
  Admin'`, `is_super_admin = TRUE`, `tenant_id = NULL`, `status = 'ACTIVE'`. Keep the
  generated SQL and credentials out of git and out of shell history.
- Sign in once to confirm, change the password, then create further admins through the
  API using the super-admin token.

## 4. Before and after deploying

- Before: `npm run verify`, then `npm run test:e2e`. Both must exit 0.
  Playwright's backend listens on `127.0.0.1:5055` because pgAdmin 4 uses 5050 by
  default; override with `E2E_BACKEND_PORT` if that port is taken too.
- Local sanity check: with `npm run dev` running, `npm run smoke:local` hits
  `/health`, login, the list routes and CRUD against the **dev** database.
- Take a backup first: `pg_dump --format=custom` (see `docs/OPERATIONS.md`).
- After: `GET /health` returns HTTP 200 with `"db":"connected"`.

## 5. Rollback

- **Code:** redeploy the previous git tag. The backend is stateless, so the prior build
  is safe as soon as it starts. Never hand-edit files on the host. Tags are listed in
  `docs/RESTORE.md`.
- **Database:** no down-migration is needed for additive migrations — older code keeps
  working against the newer schema. Never drop tables or columns as a "rollback". If a
  change truly must be undone, write a new forward migration and rehearse it first.
- Restore procedure and tag inventory: `docs/RESTORE.md`; live deploy plan:
  `docs/RELEASE.md`.
