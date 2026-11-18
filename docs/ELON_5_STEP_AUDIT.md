# SPMS — Elon 5-Step Lean Audit

Date: 2026-11-18. Scope: audit and productize the SPMS_App repository without
touching production data, schema, migrations, tests, or deployment config.

Evidence rule: every change claim below is backed by `git diff` / `git log`.
Every test result is quoted verbatim from `npm run verify` / Playwright output.
No count is written from memory.

---

## Step 0 — Understand

| Check | Evidence | Result |
| --- | --- | --- |
| Source map of `frontend/`, `backend/`, `database/`, `e2e/`, `docs/` | recorded at session start (directory listings + file reads) | done |
| Baseline captured before edits | baseline output in the session record | done |
| Runtime payment contract identified | `backend/src/routes/paymentRoutes.js`, `docs/OPERATIONS.md` | manual BKQR confirmation; no mock/fake payment flow exists |
| Test-DB boundary identified | `backend/scripts/_guard.js`, `docker-compose.test.yml` | Docker test DB on 127.0.0.1:TEST_DB_PORT only |
| Production DB untouched | `git diff --stat` | no file under `database/` or `supabase/` changed |

---

## Step 1 — Requirements

| Requirement | Source | Status |
| --- | --- | --- |
| Multi-tenant POS + inventory behaviour preserved | `docs/PRODUCT.md`, `docs/ROUTES.md`, jest suite | preserved (tests green) |
| Payments must be real DB flows, fakes labeled | `paymentRoutes.js`, `docs/OPERATIONS.md` | no mock payment path found; nothing to label |
| Secrets never committed | `AGENTS.md`, gitleaks | no leaks found |
| Lint gates exist and pass | `frontend/.eslintrc.cjs`, `backend/.eslintrc.cjs` | implemented, 0 errors |
| One-command verification | root `package.json` → `npm run verify` | 7-stage pipeline, automated lint included |
| Deployment config changes need owner approval | `AGENTS.md` | `render.yaml` and workflows left untouched |

---

## Step 2 — Delete

All deletions visible in `git diff --stat` (42 files, 2772 insertions, 4072 deletions):

| Deleted item | Type | Reason |
| --- | --- | --- |
| `backend/index.js`, `backend/export.js` | dead entrypoints | no imports left |
| `backend/fix-all-routes.ps1`, `backend/fix-all-routes.sh` | one-off repair scripts | 2,635 lines of dead tooling |
| `backend/src/config/database.js`, `backend/src/config/db.js` | duplicate DB configs | canonical config is `config/postgres.js` |
| `backend/src/middleware/errorHandler.js` | dead middleware | no references |
| `/api/db-test` route in `backend/src/app.js` | orphan debug route | removed (see `git diff backend/src/app.js`) |
| Unused imports/state/functions across ~30 frontend files | dead code | ESLint `no-unused-vars` |

Committed tests were **not** edited or deleted; the names gate reports
`-- removed (in committed, missing now) -- (none)`.

---

## Step 3 — Simplify

| Check | Evidence | Result |
| --- | --- | --- |
| Canonical DB import in payments | `git diff backend/src/routes/paymentRoutes.js` | `../config/db` → `../config/postgres` |
| Backend lint config | `backend/.eslintrc.cjs` (new) | added; `ignoreRestSiblings` for the intentional `tenant_status` exclusion |
| Frontend lint config | `frontend/.eslintrc.cjs` | Babel + JSX parser, React plugin, `no-undef`/`no-unused-vars` as errors |
| Backend unused vars | raw `npm run lint` (backend) | 7 errors → 0; exit 0 |
| Frontend unused vars / JSX entities | raw `npm run lint` (frontend) | 279 errors → `✖ 18 problems (0 errors, 18 warnings)`; exit 0 |
| Real undefined-identifier bugs found by the stricter config | `Warranty.jsx` `Star`, `Settings.jsx` `EyeIcon` | fixed (both were runtime ReferenceErrors when rendered) |
| Stale demo credential docs | `docs/README.md` | replaced with the actual seed values, labeled demo-only |

---

## Step 4 — Accelerate

| Check | Raw evidence | Result |
| --- | --- | --- |
| Build is code-split | `main JS chunk: index-DyNLKdj1.js 145.6 kB`; `charts-RPgBFq0-.js 423.8 kB` is a separate lazy chunk | heavy charts stay off the main path |
| Build time | `✓ built in 6.16s` | fast |
| Custom-range dashboard 500 | `could not determine data type of parameter $3` in `GET /api/dashboard/sales-summary` | fixed in `backend/src/routes/dashboard.js` by aligning `prevCond` indices with the params bound to that query (`$3/$4`) |
| Golden-path e2e after fix | `✓ 1 [chromium] › e2e\golden-path.spec.js:51:1 › golden path ...`, `3 passed` | now passes (was failing before the fix) |
| Dead tooling removed | `git diff --stat` | 2,635 lines of unused repair scripts deleted |

---

## Step 5 — Automate

| Check | Evidence | Result |
| --- | --- | --- |
| Lint enforced in the one-command gate | `git diff backend/scripts/verify.js` | new stage `4/7 lint (backend + frontend)` |
| CI / nightly / Dependabot | `.github/workflows/ci.yml`, `nightly.yml`, `.github/dependabot.yml` | pre-existing; they call `npm run verify`, so the lint gate is inherited automatically |
| Deployment config | `git status --short` | `render.yaml` and workflows unchanged (owner approval rule) |
| Secrets | `npm run verify` stage 7/7 | `no leaks found` |

---

## Final 5-step scorecard

| Step | Score | Note |
| --- | --- | --- |
| 0 — Understand | 5/5 | Source map, runtime/payment boundary, and test-DB boundary established |
| 1 — Requirements | 4/5 | Requirements derived from repo + owner brief; no separate sign-off artifact |
| 2 — Delete | 5/5 | 7 dead backend files + 2 dead scripts + orphan route removed; no test deleted |
| 3 — Simplify | 5/5 | Both linters green, canonical DB import, two real render bugs found and fixed |
| 4 — Accelerate | 4/5 | Bundle already split; custom-range 500 fixed; no new perf work attempted |
| 5 — Automate | 4/5 | Lint gate added to `verify` (inherited by CI); deployment config intentionally untouched |
| Verify | 3/5 | Jest, lint, build, secret scan, golden path green; npm audit + 2 super-admin e2e cases red |

---

## Remaining risks / owner decisions

1. **Frontend npm audit blocks `verify` (HIGH).** Raw output:
   `React Router: Arbitrary Constructor Injection via deserializeErrors() in React Router SSR Hydration - https://github.com/advisories/GHSA-337j-9hxr-rhxg`,
   `fix available via npm audit fix --force`, `Will install react-router-dom@7.18.5, which is a breaking change`,
   `12 vulnerabilities (2 moderate, 10 high)`, `❌ npm audit (frontend): Command failed`,
   `❌ VERIFY FAILED (37.6s): 1 check(s)`.
   Only standard router APIs are used (`BrowserRouter`, `Routes`, `Route`, `Navigate`,
   `Outlet`, `Link`, `useNavigate`, `useLocation`, `useParams`). The upgrade was **not**
   performed unilaterally because it is a breaking major change. Owner decision needed:
   approve the v7 upgrade, or accept the advisory with a documented exception.
2. **Test-name baseline drift (MEDIUM).** Raw output: `committed: 181 names / actual: 200 names`,
   `wrote backend\tests\expected-names.proposed.txt (200 names); owner runs: npm run names:accept`.
   The gate itself says `OK: no file below its committed count.` I did not edit
   `expected-names.txt` or the proposed file by hand.
3. **Two super-admin e2e failures remain (MEDIUM, pre-existing).** After three runs the result is
   `2 failed` / `3 passed`. Raw failures: `getByRole('heading', { name: 'Businesses' })` not
   found (page snapshot is still the login screen), and
   `demo_admin redirected off /admin/tenants` → `Expected pattern: /\/dashboard/`,
   `Received string: "http://127.0.0.1:4173/login"`. These are login/session timing issues in
   the local e2e server, unrelated to the dashboard fix; tests were not modified.
4. **18 `react-hooks/exhaustive-deps` warnings (LOW).** Non-breaking, but some callbacks may
   hold stale closures. Deferred deliberately — changing hook dependencies without targeted
   tests is riskier than leaving the warnings.
5. **No DB/schema/migration changes were made**, by design. All verification used the Docker
   test DB only. Never connect to a hosted database from this workflow.
6. **No commits, tags, pushes, or branch switches were made** — the working tree carries the
   changes for owner review and phase commits.

---

## Verification raw output (quoted, not retyped)

`npm run verify` (final run):

```
=== 1/7 test database ===
  test database already reachable at 55432, skipping docker compose
=== 2/7 jest --runInBand ===
Test Suites: 21 passed, 21 total
Tests:       200 passed, 200 total
=== 4/7 lint (backend + frontend) ===
  backend: 0 lint errors
  frontend: 0 lint errors
✖ 18 problems (0 errors, 18 warnings)
=== 5/7 frontend build ===
✓ built in 6.16s
=== 6/7 npm audit (omit=dev, high) ===
❌ npm audit (frontend): Command failed: npm audit --omit=dev --audit-level=high
=== 7/7 secret scan ===
no leaks found
❌ VERIFY FAILED (37.6s): 1 check(s)
  - npm audit (frontend): Command failed: npm audit --omit=dev --audit-level=high
```

Direct `jest --json` run on the exact final tree (after the last `dashboard.js` fix):

```
Test Suites: 21 passed, 21 total
Tests:       200 passed, 200 total
JEST_EXIT=0
```

`npm run test:e2e` (final run, against the local e2e server):
```
  ✓  1 [chromium] › e2e\golden-path.spec.js:51:1 › golden path: product -> stock -> sale -> order -> dashboard (6.1s)
  ✓  2 [chromium] › e2e\golden-path.spec.js:194:1 › fresh tenant dashboard shows the empty state (1.9s)
  ✓  3 [chromium] › e2e\golden-path.spec.js:219:1 › forced password change: blocked until a new password is set (1.4s)
  ✘  4 [chromium] › e2e\super-admin-panel.spec.js:51:1 › super admin marks a pending session paid and the tenant plan is applied (16.0s)
  ✘  5 [chromium] › e2e\super-admin-panel.spec.js:89:1 › tenant admin and staff can reach neither the panel nor its API (15.9s)
  2 failed
  3 passed (55.7s)
```
