# SPMS Production Acceptance Checklist (Phase D)

> Status is evidence-based. “PASS” only where executed in this session or clearly evidenced. Remote production deployment is **NOT** executed.

| Area | Acceptance gate | Status | Evidence / Notes |
|---|---|---:|---|
| Jest | All tests pass | PASS | `npm run verify` rerun: 25 suites / 223 tests passed |
| ESLint | Zero errors | PASS | verify: backend 0, frontend 0 |
| Frontend build | Pass | PASS | verify: Vite production build passed |
| Dependency audit | No high/critical production issues | PASS | verify: npm audit (omit=dev, high) clean for root/backend/frontend |
| Secret scan | No leaked secrets | PASS | verify: gitleaks 8.30.1, no leaks found |
| Playwright E2E | All expected tests pass | PASS | `npm run test:e2e`: 74 passed (4.1m), 0 failed, 0 skipped (current session) |
| Login flow | Pass | PASS | Covered by e2e (golden-path, forced password, auth flows) and jest auth tests |
| Dashboard | Pass | PASS | Covered by e2e dashboard/sales-summary/golden-path specs |
| Tenant A/B isolation | Pass | PARTIAL | App-level scoping reviewed; e2e includes super-admin/tenant boundary checks; no dedicated two-tenant DB-role RLS isolation test added due owner-controlled expected-names gate. Recommend owner-approved tests. |
| Super Admin authorization | Pass | PASS | e2e super-admin-panel and route-smoke specs passed |
| CRUD workflows | Pass | PASS | e2e covers users/customers/products/orders/warranties/services flows |
| Purchase and inventory | Pass | PASS | golden-path and orders-purchase-form e2e specs passed |
| Orders and payment flows | Pass | PASS | golden-path/orders e2e specs passed; payment/manual settlement covered by super-admin-panel |
| Reports and pagination | Pass | PASS | list-paging-regression and reports e2e specs passed |
| Migration rehearsal | Pass | PASS | Local PG17.11 baseline+015-030 rehearsal and Build A/B equivalence (586/586, no diffs) |
| Baseline comparison | Pass | PASS | `database/baseline.sql` regenerated via generator; equivalence 586/586 |
| Health checks | Pass | PASS (local code) | `/health/live`, `/health/ready`, `/health` implemented; graceful shutdown added; remote/staging runtime not verified |
| Graceful shutdown | Pass | PASS (local code) | SIGTERM/SIGINT handlers close server + DB pool |
| SSL validation | Pass in staging | NOT TESTED | No staging Supabase connection executed; code enforces `rejectUnauthorized:true` and `DB_SSL_CA` support |
| Production connection | Not claimed until actually tested | NOT TESTED / NOT AUTHORIZED | No remote DB connection/change performed |

## Remote safety
- Target `SPMS_server` (`ocdmrxtbvsepmkrweetd`) **not modified**. No remote DDL/DML/roles/grants/RLS/data import/reset.