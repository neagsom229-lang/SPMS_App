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

1. **Dev-only audit advisories (LOW).** Plain `npm audit` (no `--omit=dev`) reports
   2 advisories in the frontend dev toolchain. The verify gate audits production
   dependencies only, as designed. Track in Dependabot.
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
