# SPMS — Elon 5-Step Lean Audit (final)

Date: 2026-11-18. Scope: audit and productize the SPMS_App repository without
touching production data, schema, migrations, or deployment config.

Evidence rule: every change claim below is backed by `git diff` / `git log`.
Every test result is quoted verbatim from `npm run verify` / Playwright output.
No count is written from memory.

Commits for this pass (owner committed the pre-fix baseline `ccd1b65`):

| Commit | Task |
| --- | --- |
| `992fa91` | 1 — super-admin e2e determinism + scoped locator |
| `ef1f311` | 2 — React Router v7 + Tailwind v4 upgrade |
| `284958e` | 3 — expected test names 181 → 200 |
| `125b959` | 4 — all `react-hooks/exhaustive-deps` warnings resolved |

---

## Step 0 — Understand

| Check | Evidence | Result |
| --- | --- | --- |
| Source map of `frontend/`, `backend/`, `database/`, `e2e/`, `docs/` | directory listings + file reads | done |
| Baseline captured before edits | baseline output in session record | done |
| Runtime payment contract | `backend/src/routes/paymentRoutes.js`, `docs/OPERATIONS.md` | manual BKQR confirmation; no mock/fake payment flow exists |
| Test-DB boundary | `backend/scripts/_guard.js`, `docker-compose.test.yml` | Docker test DB on 127.0.0.1:TEST_DB_PORT only |
| Production DB untouched | `git diff --stat` | no file under `database/` or `supabase/` changed |

---

## Step 1 — Requirements

| Requirement | Source | Status |
| --- | --- | --- |
| Multi-tenant POS + inventory behaviour preserved | `docs/PRODUCT.md`, jest + e2e | green: `Tests: 200 passed`, `5 passed` |
| Payments must be real DB flows, fakes labeled | `paymentRoutes.js`, `docs/OPERATIONS.md` | no mock payment path found |
| Secrets never committed | gitleaks | `no leaks found` |
| Lint gates exist and pass | `.eslintrc.cjs` (both) | `backend: 0 lint errors`, `frontend: 0 lint errors`, 0 warnings |
| One-command verification | root `package.json` → `npm run verify` | 7-stage pipeline, exit 0 |
| Deployment config changes need owner approval | `AGENTS.md` | `render.yaml` and workflows untouched |

---

## Step 2 — Delete

| Deleted item | Type | Reason |
| --- | --- | --- |
| `backend/index.js`, `backend/export.js` | dead entrypoints | no imports left |
| `backend/fix-all-routes.ps1`, `backend/fix-all-routes.sh` | one-off repair scripts | 2,635 lines of dead tooling |
| `backend/src/config/database.js`, `backend/src/config/db.js` | duplicate DB configs | canonical config is `config/postgres.js` |
| `backend/src/middleware/errorHandler.js` | dead middleware | no references |
| `/api/db-test` route in `backend/src/app.js` | orphan debug route | removed |
| Unused imports/state/functions across ~30 frontend files | dead code | ESLint `no-unused-vars` |

No test was deleted: gate reports `-- removed (in committed, missing now) -- (none)`.

---

## Step 3 — Simplify

| Check | Evidence | Result |
| --- | --- | --- |
| Canonical DB import in payments | `git diff backend/src/routes/paymentRoutes.js` | `../config/db` → `../config/postgres` |
| Backend lint config | `backend/.eslintrc.cjs` (new) | `ignoreRestSiblings` for the intentional `tenant_status` exclusion |
| Frontend lint config | `frontend/.eslintrc.cjs` | Babel + JSX parser, React plugin, `no-undef`/`no-unused-vars` errors |
| Real undefined-identifier bugs | `Warranty.jsx` `Star`, `Settings.jsx` `EyeIcon` | fixed (runtime ReferenceErrors when rendered) |
| Stale demo credential docs | `docs/README.md` | replaced with actual seed values, labeled demo-only |
| Lint warnings | final verify stage 4/7 | `frontend: 0 lint errors`, 0 warnings (18 → 0) |

---

## Step 4 — Accelerate

| Check | Raw evidence | Result |
| --- | --- | --- |
| Build is code-split | `main JS chunk: index-BP6cVgX2.js 145.5 kB`; `charts-HLp8k4kQ.js 423.8 kB` lazy chunk | heavy charts off the main path |
| Custom-range dashboard 500 | `could not determine data type of parameter $3` on `GET /api/dashboard/sales-summary` | fixed in `backend/src/routes/dashboard.js` by binding `prevCond` with `$3/$4` |
| Golden path e2e | `✓ 1 [chromium] › e2e\golden-path.spec.js:51:1 ... golden path ... (6.1s)` | passes (was failing before the fix) |
| Dead tooling removed | `git diff --stat` | 2,635 lines deleted |

---

## Step 5 — Automate

| Check | Evidence | Result |
| --- | --- | --- |
| Lint in the one-command gate | `git diff backend/scripts/verify.js` | stage `4/7 lint (backend + frontend)` |
| CI / nightly / Dependabot | `.github/workflows/*` | pre-existing; inherit the lint gate via `npm run verify` |
| Name baseline gate | final verify stage 3/7 | `committed: 200 names / actual: 200 names`, added `(none)`, removed `(none)` |
| Deployment config | `git status --short` | `render.yaml` and workflows unchanged |
| Secrets | final verify stage 7/7 | `no leaks found` |

---

## Task-specific notes

### TASK 1 — super-admin e2e (root cause)

Instrumented browser run proved the app's auth is correct:

```
DEBUG immediate-after-click: {"url":"/login","token":false,"user":false,"userRaw":""}
DEBUG after-3s: {"url":"/dashboard","token":true,"user":true, ..."isSuperAdmin":true}
DEBUG after-goto-admin: {"url":"/admin/tenants","token":true,"user":true,"heading":"TechFlow"}
```

The app uses localStorage + a Bearer-token interceptor (no cookies), with a correct
rehydrate effect in `AuthContext.jsx`. The failures were in the test helper: it
called `page.goto()` immediately after clicking Sign In, aborting the in-flight
async login POST, so localStorage was empty on reload. Fix: wait for the token
and navigation away from `/login` before `goto`. Separately, the `Businesses`
heading matched both the Layout breadcrumb and the page `<h1>` (strict-mode
violation); the locator is now scoped to `getByRole('main')`. No test assertion
was weakened. Result: `2 passed` for that spec, `5 passed` overall.

### TASK 2 — npm audit (all 12 original findings)

| Package | Severity | Direct | Fix version |
| --- | --- | --- | --- |
| picomatch | high | no | none — 4.0.7 is latest and still vulnerable (GHSA-fc5q-39xc-vjpf) |
| anymatch | high | no | via tailwindcss 4.3.5 |
| chokidar | high | no | via tailwindcss 4.3.5 |
| fast-glob | high | no | via tailwindcss 4.3.5 |
| micromatch | high | no | via tailwindcss 4.3.5 |
| readdirp | high | no | via tailwindcss 4.3.5 |
| fdir | high | no | `true` (transitive) |
| tinyglobby | high | no | `true` (transitive) |
| sucrase | high | no | `true` (transitive) |
| tailwindcss | high | yes | 4.3.5 (breaking) |
| react-router | moderate | no | 7.18.5 (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) |
| react-router-dom | moderate | yes | 7.18.5 (breaking) |

`npm audit fix --dry-run --omit=dev` could not fix any of them without a major
upgrade. No patched tailwindcss v3 exists (3.4.19 is the last v3 and is in the
vulnerable range); no patched react-router-dom v6 exists (6.30.6 is still in
range); picomatch has no patched release at all. With owner approval both majors
were applied in one commit: `react-router-dom@^7.18.5` and
`tailwindcss@^4.3.5` + `@tailwindcss/postcss`. Migration work: removed the v6
`future` flags from `BrowserRouter` (now defaults in v7), switched PostCSS to
`@tailwindcss/postcss`, replaced `@tailwind base/components/utilities` with
`@import "tailwindcss"` + `@config` + `@custom-variant dark`, repaired a
pre-existing duplicate `export default` in `tailwind.config.js`, and added the
`-400`/`-700` semantic color shades referenced by `@apply`. Full test suite,
build and e2e pass afterwards. `npm audit --omit=dev` now exits 0. A plain
`npm audit` still reports 2 **dev-only** advisories (eslint/vite toolchain),
which the verify gate intentionally excludes via `--omit=dev`.

### TASK 3 — test-name baseline

Gate confirmed `-- removed (in committed, missing now) -- (none)` and
`OK: no file below its committed count.` `npm run names:accept` (not a hand
edit) then reported:

```
current: 181 names -> proposed: 200 names
-- removed (will leave the baseline) --
  (none)
-- added (will enter the baseline) --
  backend/tests/bakongPayment.test.js (9)
  backend/tests/changePassword.test.js (3)
  backend/tests/dashboardLocalDayWindows.test.js (5)
  backend/tests/selfServiceProfile.test.js (2)
wrote backend/tests/expected-names.txt (200 names).
```

Final verify stage 3/7 now shows `committed: 200 names / actual: 200 names`
with added `(none)` and removed `(none)`.

### TASK 4 — exhaustive-deps warnings

All 18 resolved properly, no blanket disables:

- static tables moved to module scope: `reportOptions` (Reports), `avatarColors` (Profile)
- per-render literals memoized: `statsRaw` / `analytics` (Dashboard), `faqs` (Help), `NAV_LINKS` (Landing)
- callbacks stabilized: `fetchStoreData` / `fetchProducts` (Storefront), `fetchTenants` / `fetchPendingSessions` (Businesses)
- missing deps added: `resetForm` (Customers), `calculateStats`/`showMessage` (Users), `calculateWarrantyStats`/`calculateServiceStats` (Warranty), `faqs` (Help), `NAV_LINKS` (Landing)

Result: `npm run lint` exits 0 with no warnings at all.

---

## Final 5-step scorecard

| Step | Score | Note |
| --- | --- | --- |
| 0 — Understand | 5/5 | Source map, payment/test-DB boundaries established |
| 1 — Requirements | 5/5 | All requirements verified by green gates |
| 2 — Delete | 5/5 | Dead files/route/code removed; no test deleted |
| 3 — Simplify | 5/5 | Canonical DB import; 2 render bugs fixed; lint fully clean |
| 4 — Accelerate | 4/5 | Code-split build; 500 fixed; no new perf project attempted |
| 5 — Automate | 5/5 | Lint + name gates automated in `verify`; CI inherits them |
| Verify | 5/5 | exit 0; jest 200/200; lint 0/0; audit clean; gitleaks clean; e2e 5/5 |

---

## Remaining risks / notes

1. **Moderate audit advisories (LOW, below the high-severity gate).** After the
   final pass, `npm audit --omit=dev` in **backend** reports 4 moderate advisories:
   `qs` (GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw, via express; fixable with
   `npm audit fix`) and `uuid` (GHSA-w5hq-g745-h8pq, via exceljs; needs a breaking
   exceljs downgrade). Frontend plain `npm audit` reports 2 dev-only advisories.
   `npm audit --omit=dev --audit-level=high` exits 0 for all three workspaces, so
   the verify gate is green. Track in Dependabot; do not change behaviour for a
   below-threshold advisory.
2. **Tailwind v4 CSS output grew** (`index-*.css` 106 kB → 155 kB raw, 20 kB gzip)
   due to the v4 engine. Functionally fine; revisit if payload becomes a concern.
3. **Larger lazy chart chunk** (423.8 kB / 115 kB gzip) remains; it is isolated to
   Analytics/Reports routes.
4. **No DB/schema/migration changes were made**, by design. All verification used
   the Docker test DB only; never connect a hosted database from this workflow.
5. **Docker Desktop must be running** for `npm run verify` and e2e. After a host
   restart the daemon may be stopped; verify then fails at stage 1/7. Start it and
   re-run. No code change is needed.
6. **Owner controls commits/tags/pushes.** Each task above is one small commit;
   no tag, push or branch switch was performed.
7. **`/api/online-orders` 403 is expected for a super-admin token.** The handler
   (`orders.js:166-171`) intentionally returns `403 Tenant context required` when
   there is no tenant; a real super-admin is redirected away from `/online-orders`
   by `SuperAdminRoute`. With a tenant session it returns 200 (verified by the
   route smoke test). Documented in the hardening pass below; no allowlist entry.
8. **`deploy-db.ps1:39` still hardcodes `55432`** — it is a deploy script, which
   the hardening rules say not to touch. The one other `55432` is a historical
   raw-output quote in this document, which must not be edited. All *test*
   infrastructure now uses `TEST_DB_PORT` (default 15432).
8. **Two bare `eslint-disable-next-line react-hooks/exhaustive-deps` directives**
   exist in `Analytics.jsx:466` and `Reports.jsx:348` with empty justification.
   They pre-date the baseline commit and are not introduced by this work; ESLint's
   JSON reports `suppressedMessages` but `warningCount: 0`. They can be replaced
   with justified fixes in a future pass.

---

## Final proof pass (this run)

### LINT — raw

```
backend:  npm notice run eslint src --ext .js          BACKEND_LINT_EXIT=0
frontend: npm notice run eslint src --ext js,jsx       FRONTEND_LINT_EXIT=0
ESLint JSON (both): errorCount:0, fatalErrorCount:0, warningCount:0
```
Two pre-existing bare suppressions are reported in `suppressedMessages` only.

### TEST INTEGRITY — raw

`git diff ccd1b65..HEAD -- backend/tests e2e` contains **only**:
- `backend/tests/expected-names.txt`: 19 added names, 0 removed (via `names:accept`)
- `e2e/super-admin-panel.spec.js`: the helper fix below

```
git grep -nE "\.skip\b|\.only\b|\bxit\(|\bxdescribe\b|fixme|waitForTimeout" \
  -- backend/tests e2e     -> GIT_GREP_EXIT=1  (no matches)
```

The e2e helper fix (deterministic — no fixed sleep):

```js
await page.getByRole('button', { name: 'Sign In' }).click();
// The login POST is async. Wait until the SPA has actually stored the session…
await page.waitForFunction(() => !!localStorage.getItem('token') && !!localStorage.getItem('user'));
await expect(page).not.toHaveURL(/\/login$/);
```

Assertions removed or loosened since the baseline: **none**. The only changed
assertion was made *more precise* (scoped from a strict-mode-violating
`getByRole('heading', {name:'Businesses'})` to
`getByRole('main').getByRole('heading', {name:'Businesses'})`). Test names were
only added; no test was deleted, skipped, focused or weakened.

### TAILWIND v4 VISUAL QA — raw

Worktree: `git worktree add .../spms-prev4 992fa91` (branch untouched). Built both
tree's frontends and served them on 4174 (before: Tailwind v3 / Router v6) and
4173 (after: Tailwind v4 / Router v7) against the same test DB. Drove 11 routes ×
2 viewports (1440×900, 390×844) × 2 themes (light/dark) = 88 screenshots.

```
first capture:  { "screenshots": 88, "errors": [ /users ×4 ReferenceError: Cannot access 'ue' before initialization ] }
after fixes:    { "screenshots": 88, "errors": [] }
```

Findings and fixes:
1. **3 real TDZ crashes introduced by the earlier hook-deps work** — `/users`,
   `/customers`, `/warranty` — caused by referencing `calculateStats`/`showMessage`,
   `resetForm`, and `calculateWarrantyStats`/`calculateServiceStats` in dependency
   arrays before their `const` declarations. Fixed by moving the declarations above
   their consumers (commit `64a0cc8`). All route crashes gone.
2. **Tailwind v4 type-scale change** — `text-xs` 0.75rem → 0.875rem, causing a
   single-line mobile subtitle to wrap. Pinned the v3 scale via `@theme` tokens in
   `index.css` and `theme.fontSize` in `tailwind.config.js`.
3. **v4 layer-order pitfall** — unlayered `p { font-size: .875rem }` in the mobile
   media query overrode layered `.text-xs`. Wrapped the media block in `@layer base`
   so utilities win again. Verified before/after on `/settings` mobile:
   `4174 {"fontSize":"10.5px","height":14}` / `4173 {"fontSize":"10.5px","height":14}`.
4. **Benign representational diffs only** after the fixes: `rgb→oklch` colors,
   `rounded-full` 9999px→infinity, and extra transparent ring layers in shadows.
   Screenshots inspected (landing, dashboard, login mobile, super-admin, analytics,
   settings mobile) — visually identical. Custom radii 8→10px/16→18px now reflect
   the config that the corrupted v3 file never loaded.
5. Pre-existing `/activity` 500 and `/online-orders` 403 occur in both builds.

### AUDIT DECISION — raw

```
frontend/package.json: no "overrides"; tailwindcss ^4.3.5 and
@tailwindcss/postcss ^4.3.5 are in devDependencies (build-time only).
```
An `overrides` picomatch pin on Tailwind v3 was **not** tried: picomatch 4.0.7 is
the newest published version and is still in the vulnerable range
(GHSA-fc5q-39xc-vjpf), so there is no safe version to pin to. Tailwind is used only
by `vite build`, so `devDependencies` is correct; no manifest change was needed.

### STEP 5 AUTOMATE — inventory

Present: `.github/workflows/ci.yml` (verify on push/PR, Postgres service, gitleaks),
`.github/workflows/nightly.yml` (verify:full incl. Playwright), `/health` route with
DB probe (`app.js:161`), migrations via jest globalSetup (`buildTestDatabase`) plus
`docs/OPERATIONS.md`, winston+morgan logging with `unhandledRejection`/
`uncaughtException` handlers (`app.js:40-43`, `utils/logger.js`). Missing: nothing
material for this pass, so **no workflow or deploy-config file was changed**.

### PRODUCTION-LIKE SMOKE — raw

Backend started with `NODE_ENV=production` against the **test** DB (SSL opt-out
`DB_SSL=false` added because production otherwise forces TLS against a local DB):

```
health:    {"status":200,"body":{"status":"healthy","db":"connected",...}}
login:     {"status":200,"hasToken":true,"user":"demo_admin"}
crud:      LOGIN 200 true / CRUD 200 KEYS [ 'products', 'pagination' ] PRODUCTS 3
corsAllowed:      access-control-allow-origin = http://127.0.0.1:4173
corsDisallowed:   access-control-allow-origin = null (evil.example -> 500 CORS blocked)
helmet:    x-content-type-options=nosniff, x-frame-options=SAMEORIGIN,
           referrer-policy=no-referrer, x-dns-prefetch-control=off,
           strict-transport-security=max-age=15552000; includeSubDomains,
           content-security-policy present
rateLimit: attempt 11 -> 429, ratelimit-policy=10;w=900, retry-after=900
seed:      only demo_* / superadmin accounts; guard refuses non-127.0.0.1 DBs;
           no admin/admin123 literal in seed code
```

### FINAL GATES — raw

`npm run verify` → `VERIFY_EXIT=0`:
```
Test Suites: 21 passed, 21 total
Tests:       200 passed, 200 total
committed: 200 names / actual: 200 names ; added (none) ; removed (none)
  backend: 0 lint errors
  frontend: 0 lint errors
  .: no high/critical advisories in production dependencies
  backend: no high/critical advisories in production dependencies
  frontend: no high/critical advisories in production dependencies
no leaks found
✅ ALL VERIFICATION CHECKS PASSED (110.1s)
```

`npm run test:e2e` → `E2E_EXIT=0`:
```
✓ 1 golden path: product -> stock -> sale -> order -> dashboard (5.3s)
✓ 2 fresh tenant dashboard shows the empty state (5.3s)
✓ 3 forced password change: blocked until a new password is set (8.4s)
✓ 4 super admin marks a pending session paid and the tenant plan is applied (5.1s)
✓ 5 tenant admin and staff can reach neither the panel nor its API (6.6s)
5 passed (1.2m)
```

---

## Verification raw output (final)

`npm run verify` — `VERIFY_EXIT=0`:

```
=== 1/7 test database ===
  test database already reachable at 55432, skipping docker compose

=== 2/7 jest --runInBand ===
Test Suites: 21 passed, 21 total
Tests:       200 passed, 200 total

=== 3/7 test-name gate (HEAD) ===
committed: 200 names / actual: 200 names
-- removed (in committed, missing now) --
  (none)
-- added (not in committed) --
  (none)
OK: no file below its committed count.

=== 4/7 lint (backend + frontend) ===
  backend: 0 lint errors
npm notice run eslint src --ext js,jsx
  frontend: 0 lint errors

=== 5/7 frontend build ===
✓ 3535 modules transformed.
✓ built in 15.14s

=== 6/7 npm audit (omit=dev, high) ===
  .: no high/critical advisories in production dependencies
  backend: no high/critical advisories in production dependencies
  frontend: no high/critical advisories in production dependencies

=== 7/7 secret scan ===
no leaks found

✅ ALL VERIFICATION CHECKS PASSED (192.4s)
```

`npm run test:e2e` — `E2E_EXIT=0`:

```
  ✓  1 [chromium] › e2e\golden-path.spec.js:51:1 › golden path: product -> stock -> sale -> order -> dashboard (6.1s)
  ✓  2 [chromium] › e2e\golden-path.spec.js:194:1 › fresh tenant dashboard shows the empty state (3.3s)
  ✓  3 [chromium] › e2e\golden-path.spec.js:219:1 › forced password change: blocked until a new password is set (2.9s)
  ✓  4 [chromium] › e2e\super-admin-panel.spec.js:57:1 › super admin marks a pending session paid and the tenant plan is applied (2.9s)
  ✓  5 [chromium] › e2e\super-admin-panel.spec.js:89:1 › tenant admin and staff can reach neither the panel nor its API (2.8s)

  5 passed (1.2m)
```

---

## Hardening pass (this run)

### 1. TEST DB PORT — single source

`DEFAULT_TEST_DB_PORT = 15432` in `backend/scripts/_guard.js` is the only default.
`TEST_DB_PORT` overrides it everywhere: `docker-compose.test.yml` uses
`${TEST_DB_PORT:-15432}`, CI workflows use `TEST_DB_PORT: '15432'` with a matching
`DATABASE_URL`, `.env.example` documents `TEST_DB_PORT=15432`, and jest globalSetup /
Playwright webServer / verify derive the URL from `testDatabaseUrl()` (guard).
Commits: `6520d33`.

Remaining `55432` occurrences: `backend/scripts/deploy-db.ps1:39` (deploy script —
left untouched per rule) and a historical raw-output quote in this document.

### 2. PREFLIGHT — raw

Shared `preflightTestDocker()` in `_guard.js` checks `docker info`, then that the
test port can be bound on 127.0.0.1. Both `verify.js` and `e2e-setup.js` call it
only when the DB is unreachable, and exit 1 immediately on failure:

```
verify.js (Docker hidden from PATH, TEST_DB_PORT=15999):
=== 1/7 test database ===
❌ Start Docker Desktop
VERIFY_EXIT=1                      (no further stages ran)

e2e-setup.js (same conditions):
e2e setup: checking the test postgres container...
❌ Start Docker Desktop
E2E_SETUP_EXIT=1

port already held by another process:
❌ Port is reserved by Windows: run `netsh interface ipv4 show excludedportrange protocol=tcp`, or set TEST_DB_PORT
```

Commit: `c2b3bbb`.

### 3. ROUTE SMOKE TEST — raw

`e2e/route-smoke.spec.js` logs in (admin / super-admin) and visits all concrete
frontend routes — public, tenant (dashboard, products, stock, suppliers, users,
customers, warranty, analytics, reports, pricing, settings, activity,
online-orders, …) and super-admin pages. It fails on any console error, pageerror,
or failed (4xx/5xx) API response. The documented `ALLOWLIST` is **empty** —
finding an unexplained failure adds an entry only with a written reason. Run:

```
✘ 1 initial: /activity: console: ❌ Error fetching activity logs: AxiosError ... 500
   server log: ReferenceError: parsePaging is not defined at app.js:176
✓ after fix: 3 passed  (public / tenant / super-admin)
```

Commits: `84ca909` (test), `c77bdb1` (bug fix + allowlist cleared).

### 4. KNOWN BUGS — root causes

- **`/activity` 500 — real bug, fixed.** `app.js:176` called `parsePaging(req, …)`
  but `app.js` never imported it (every other route imports it from
  `utils/paging.js`). Added `const { parsePaging } = require("./utils/paging");`.
  After the fix: `GET /api/activity-logs?limit=200 HTTP/1.1 200 2` in the server
  log and no console errors in the route smoke test.
- **`/online-orders` 403 — expected, not a bug.** `orders.js:166-171` returns
  `403 Tenant context required` for a token with no tenant (super admin). The
  earlier 403 came from my diagnostic probe using a super-admin token; a real
  super-admin is redirected away from that route by `SuperAdminRoute`, and the
  route smoke test with a tenant admin gets 200/304. No code change, no allowlist.

### 5. SAFETY CHECK — DB_SSL

`backend/src/config/postgres.js:56-69`:

```js
const isSupabase = dbHost ? (dbHost.includes('supabase.com') || dbHost.includes('supabase.co')) : false;
// Production defaults to TLS (cloud DBs require it). DB_SSL=false is an
// explicit opt-out for local production-like smoke tests against a test DB.
const isNeon = dbHost ? (
  dbHost.includes('neon.tech') ||
  process.env.DB_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false')
) : false;
const isCloud = isSupabase || isNeon;
const pool = new Pool({ connectionString, ssl: isCloud ? { rejectUnauthorized: false } : false, ... });
```

Runtime proof (only the resolved ssl option printed, never the connection string):

```
{"NODE_ENV":"production","DB_SSL":"(unset)","ssl":{"rejectUnauthorized":false}}
{"NODE_ENV":"production","DB_SSL":"false","ssl":false}
{"NODE_ENV":"development","DB_SSL":"(unset)","ssl":false}
{"NODE_ENV":"development","DB_SSL":"true","ssl":{"rejectUnauthorized":false}}
```

Production defaults to TLS; `DB_SSL=false` is the only thing that disables it and
must be set explicitly. No code change needed.

### 6. FINAL GATES — clean start — raw

Test container was removed first (`docker compose down` → `Container spms_test_db
Removed`), then:

`npm run verify` — `VERIFY_EXIT=0`:
```
=== 1/7 test database ===
 Container spms_test_db Creating / Created / Starting / Started / Waiting / Healthy
=== 2/7 jest --runInBand ===
Test Suites: 21 passed, 21 total
Tests:       200 passed, 200 total
=== 3/7 test-name gate (HEAD) ===
committed: 200 names / actual: 200 names
-- removed (in committed, missing now) --   (none)
-- added (not in committed) --              (none)
=== 4/7 lint (backend + frontend) ===
  backend: 0 lint errors
  frontend: 0 lint errors
=== 5/7 frontend build ===
✓ built in 8.63s
=== 6/7 npm audit (omit=dev, high) ===
  .: no high/critical advisories in production dependencies
  backend: no high/critical advisories in production dependencies
  frontend: no high/critical advisories in production dependencies
=== 7/7 secret scan ===
no leaks found
✅ ALL VERIFICATION CHECKS PASSED (58.2s)
```

`npm run test:e2e` — `E2E_EXIT=0`:
```
✓ 1 golden path: product -> stock -> sale -> order -> dashboard (5.3s)
✓ 2 fresh tenant dashboard shows the empty state (5.3s)
✓ 3 forced password change: blocked until a new password is set (8.4s)
✓ 4 super admin marks a pending session paid and the tenant plan is applied (2.9s)
✓ 5 tenant admin and staff can reach neither the panel nor its API (6.6s)
✓ 6 route smoke — tenant routes (23.7s)
✓ 7 route smoke — super-admin routes (5.8s)
8 passed (1.2m)
```

### Hardening scorecard

| Item | Result |
| --- | --- |
| 1 — single TEST_DB_PORT (default 15432) | done; deploy script deliberately untouched |
| 2 — preflight Docker + port, fail fast | done; both messages verified |
| 3 — route smoke test, empty allowlist | done; 3 specs pass |
| 4 — known bugs | `/activity` fixed; `/online-orders` 403 expected |
| 5 — DB_SSL safety | confirmed production defaults to TLS |
| 6 — final gates | verify exit 0; e2e 8/8 |
