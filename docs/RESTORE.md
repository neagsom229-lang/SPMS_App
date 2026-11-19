# RESTORE.md — what was removed, and how to get it back

Git is the backup. Every tracked path below still exists in a tag, so a deletion is
undone with one `git checkout <tag> -- <path>`.

## Tags

| Tag | Commit | Meaning |
|---|---|---|
| `pre-lean` | `1933f2b` | Last state before the lean work. Use this to restore anything. |
| `payments-auto-v1` | `9c139b0` | Last state with automatic Bakong verification. Phase 2 deleted that code; restore from this tag. |

## Removed code

| Removed | By | Restore |
|---|---|---|
| `backend/src/models/` (7 files), `lib/serializers.js`, `middleware/validate.js`, `services/paywayService.js`, `services/stripeService.js`, `controllers/paymentController.js`, `scripts/verifier_runner.js`, `routes/analytics.js` | commit `3a215c5` (lean batch A) | `git checkout pre-lean -- backend/src/models backend/src/lib/serializers.js backend/src/middleware/validate.js backend/src/services/paywayService.js backend/src/services/stripeService.js backend/src/controllers/paymentController.js backend/scripts/verifier_runner.js backend/src/routes/analytics.js` |
| `backend/scripts/ops/` (26 one-off scripts) | Phase 1 (present at `3a215c5`, dropped by `9c139b0`) | `git checkout 3a215c5 -- backend/scripts/ops` |
| 19 unreferenced scripts under `backend/scripts/` and root `fix-api-client.mjs` | Phase 5 | `git checkout pre-lean -- backend/scripts fix-api-client.mjs` |
| `services/bakongVerifier.js`, `services/bakongReconciler.js`, `scripts/renew-bakong-token.js`, `tests/bakongVerifier.test.js`, `components/KHQRPayment.jsx` | Phase 2 (manual payments) | `git checkout payments-auto-v1 -- backend/src/services/bakongVerifier.js backend/src/services/bakongReconciler.js backend/scripts/renew-bakong-token.js backend/tests/bakongVerifier.test.js frontend/src/components/KHQRPayment.jsx` |
| `backend/scripts/perf-explain.js` (temporary Phase 5b harness) | Phase 6 | never committed; re-create from the Phase 5 report if the 027 measurements are needed again |

## `backend/scripts` inventory

Every file, what runs it, and whether it stays.

| File | Referenced by | Keep / delete |
|---|---|---|
| `_guard.js` | `tests/globalSetup.js`, `tests/setup.js`, `tests/test-databases.js`, `tests/postgresGuard.test.js`, `scripts/verify.js`, `scripts/dev.js`, `scripts/dev-db.js`, `scripts/reset-local.js`, `scripts/smoke-local.js`, `scripts/list-routes.js` | keep |
| `dev.js` | `package.json` `dev` | keep |
| `dev-env.js` | `scripts/dev.js`, `scripts/dev-db.js`, `scripts/reset-local.js`, `scripts/smoke-local.js` | keep |
| `dev-db.js` | `scripts/dev.js`, `backend/package.json` `seed`, `scripts/reset-local.js` | keep |
| `e2e-ports.js` | `playwright.config.js`, `scripts/e2e-servers.js`, `scripts/e2e-setup.js`, `e2e/*.spec.js` | keep |
| `e2e-servers.js` | `playwright.config.js` `webServer` | keep |
| `e2e-setup.js` | `scripts/e2e-servers.js` | keep |
| `flake.js` | `backend/package.json` `flake` | keep |
| `list-routes.js` | `docs/ROUTES.md` (generator) | keep |
| `make-baseline.js` | `AGENTS.md`, this file; generates `database/baseline.sql` | keep |
| `mutants.ps1` | `scripts/run-mutants.ps1` (owner writes the mutants) | keep |
| `mutation.ps1` | `scripts/run-mutants.ps1` | keep |
| `names-diff.js` | `scripts/verify.js`, `package.json` `names:diff` | keep |
| `perf-explain.js` | nothing (temporary Phase 5b harness) | delete |
| `rehearse.js` | `package.json` `rehearse` (owner-run) | keep |
| `run_migration.js` | `scripts/test-db.js`, `scripts/dev-db.js`, `scripts/rehearse.js` | keep |
| `run-mutants.ps1` | `scripts/verify-full.js`, `backend/package.json` `verify:full` | keep |
| `reset-local.js` | `package.json` `db:reset:local` | keep |
| `seed-demo.js` | `scripts/dev-db.js`, `scripts/e2e-setup.js` | keep |
| `smoke-local.js` | `package.json` `smoke:local` | keep |
| `test-db.js` | `tests/globalSetup.js`, `scripts/dev-db.js`, `scripts/e2e-setup.js`, `scripts/rehearse.js` | keep |
| `verify.js` | `package.json` `verify`, `backend/package.json` `verify` | keep |
| `verify-full.js` | `package.json` `verify:full` | keep |

## Database

- The test database is disposable. `docker compose -f docker-compose.test.yml up -d`, then
  `npm run verify` rebuilds `spms_test` from `database/baseline.sql` plus every
  pending file in `database/migrations/` (the real runner records them in
  `schema_migrations`).
- Local native mode (`DEV_DB_MODE=local`) uses `spms_db` on `127.0.0.1:5432` with
  the least-privilege role `spms_app`; provision once with
  `database/local/001_app_role.sql`. `npm run dev` preflights, migrates and seeds it.
- Docker fallback uses `spms_dev` in `docker-compose.dev.yml` on port 15433
  (DEV_DB_PORT) with a named volume. `npm run dev` starts it, runs the real
  migration runner and seeds a demo shop.
- `npm run db:reset:local` drops only the `public` schema inside `spms_db`, after a
  typed confirmation; it never drops the database, the role or Docker volumes.
- `database/baseline.sql` is generated, never hand-edited. Regenerate it with
  `node backend/scripts/make-baseline.js` (local Docker only, refuses any non-test URL).
- No production dump is stored in this repository. `prod_backup.sql` was a local, untracked
  file; Phase 6 moved it out of the repo (see below).

## Not recoverable from git (removed in Phase 6)

These were untracked local junk, deleted from the repo. An offline copy of the three data
files was taken to `C:\Users\chhea\AppData\Local\Temp\opencode\spms-offline-copy\` first:

| File | Size | Was |
|---|---|---|
| `prod_backup.sql` | 62,072 bytes | local PostgreSQL dump (21 tables with data) |
| `database/spms.accdb` | 7,340,032 bytes | tracked Access copy (still in `pre-lean`) |
| `database/spms.db` | 139,264 bytes | tracked SQLite copy (still in `pre-lean`) |
| `mutant.log`, `verify.log`, `guard.log`, `server.log`, `server.err.log` | — | run logs |
| `jest-full.json`, `nullltest.json`, `test-results/` | — | test outputs |
| `backend/names.txt`, `backend/names2.txt`, `backend/setup.log`, `backend/seed-out.txt` | — | generated scratch files |

`database/spms.accdb` and `database/spms.db` are tracked, so `git checkout pre-lean -- database/spms.accdb database/spms.db` restores them.
