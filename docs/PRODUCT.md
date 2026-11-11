# PRODUCT.md — what this product actually does

Status: **Phase 0 audit, corrected in Phase 5 and Phase 6.** The audit describes commit `1933f2b`; every path removed since then is listed in section 0.1 and marked in the tables below.
Built: 2026-11-11 from the code on disk at commit `1933f2b` ("update"), working tree clean.
Owner of every requirement below: **the owner** (single decision-maker). Column `Owner` is literal.

How this file was made: every row cites the file/route/table that proves the thing exists.
Line counts are physical lines measured with `Get-Content | Measure-Object -Line`.
Nothing here is aspirational — if it is not in the code, it is not in this file.

---

## 0. Numbers used in this document (measured, not remembered)

| Measure | Value | How measured |
|---|---|---|
| `backend/src` | 6,116 lines (33 files) | line count (Phase 6) |
| `backend/tests` | 2,459 lines (14 test files + helpers) | line count (Phase 6) |
| `frontend/src` | 48,511 lines (55 files) | line count (Phase 6) |
| Migrations | 001–027, plus `database/seeds/023_seed_massive_electronics.sql` | `database/migrations/` |
| Test cases | counted by the suite, never by hand | `npm run verify` (jest --json) |
| Frontend routes | 34 `<Route>` entries, 25 lazy chunks | `frontend/src/App.jsx` |

I did **not** run the suite in Phase 0. Phase 3 settled the count: the suite and
`backend/tests/expected-names.txt` are the only sources, and `npm run verify` prints both.

---

## 1. The jobs a pilot shop actually has

Everything below is scored against these jobs. A requirement that serves none of them is a candidate CUT.

| Job | One line | Who feels it |
|---|---|---|
| **J1** | Sell at the counter, take cash or KHQR, hand over a receipt | cashier / owner |
| **J2** | Know what is in stock, what ran out, what to reorder | owner |
| **J3** | Know today's money: revenue, profit, best sellers | owner |
| **J4** | Keep customer and supplier records, credit owed both ways | owner |
| **J5** | Take orders from customers who are not in the shop (Telegram/Facebook/phone) | owner |
| **J6** | Let staff work without trusting them with everything; see who did what | owner with staff |
| **J7** | Operate the SaaS: onboard a shop, set its plan, support it | you |

---

## 2. Backend API route groups

One row per mounted router (`backend/src/app.js` lines 254–269).

| ID | Route group | Purpose (as coded) | Evidence | LOC | Job | Owner | Proposal |
|---|---|---|---|---|---|---|---|
| A1 | `/api/auth` | login, `/me`, change-password, profile, super-admin user creation, client self-register, logout, **`/test` debug echo** | `routes/auth.js` (routes 37–369) | 369 | J1,J6,J7 | you | **KEEP**, trim `/test` |
| A2 | `/api/dashboard` | stats + sales-summary (used); `low-stock`, `pending`, `recent`, `system/stats` (**no caller**) | `routes/dashboard.js` | 605 | J3 | you | **KEEP**, CUT 4 unused handlers |
| A3 | `/api/orders` | POS checkout, list, detail, status transition, cancel, refund, online/pending/recent lists | `routes/orders.js` | 762 | J1,J3,J5 | you | **KEEP** (refund = ASK) |
| A4 | `/api/products` | catalog CRUD, publish flags, images, brand/model | `routes/products.js` | 318 | J1,J2,J5 | you | **KEEP** |
| A5 | `/api/customers` | customer CRUD, credit fields | `routes/customers.js` | 171 | J4 | you | **KEEP** |
| A6 | `/api/suppliers` | supplier CRUD + bulk delete | `routes/suppliers.js` | 150 | J4 | you | **ASK** (market stalls may not keep suppliers) |
| A7 | `/api/users` | staff CRUD, password reset, per-user subscription read | `routes/users.js` | 220 | J6 | you | **KEEP** |
| A8 | `/api/stock` | stock levels, receive, adjust, low-stock, stock log | `routes/stock.js` | 235 | J2 | you | **KEEP** |
| A9 | `/api/tenants` | super-admin tenant CRUD + `systemStatsHandler` | `routes/tenants.js` | 269 | J7 | you | **KEEP** |
| A10 | `/api/categories` | category CRUD | `routes/categories.js` | 140 | J1,J5 | you | **KEEP** |
| A11 | `/api/payment` | Bakong KHQR create/check, webhook, reconciler, simulator, legacy 410 stubs, `GET /subscription` | `routes/paymentRoutes.js` | 406 | J7 | you | **CUT** the auto-verification half; **KEEP** `GET /subscription` (read current plan) |
| A12 | `/api/warranties` | warranty record CRUD | `routes/warranties.js` | 167 | none proven | you | **ASK** |
| A13 | `/api/services` | repair/service-request CRUD (UI lives inside Warranty.jsx) | `routes/services.js` | 175 | none proven | you | **ASK** |
| A14 | `/api/analytics` | monthly-revenue, stats, top-products (`routes/analytics.js`, removed in `3a215c5`) | `routes/analytics.js` | 134 | J3 | you | **CUT** - zero callers in frontend or tests; the Analytics *page* computes client-side from `/customers`, `/products`, `/orders` |
| A15 | `/api/reports` | `GET /export/:type` (CSV/Excel) | `routes/reports.js` | 66 | J3 | you | **KEEP** |
| A16 | `/api/public` | storefront lookup, menu, public order intake, tracking code | `routes/public.js` | 488 | J5 | you | **ASK** (see F3) |
| A17 | app-level | `/health`, `/api/activity-logs` GET+DELETE, `/api/db-test`, `/api/system/stats` | `app.js` 166–277 | 301 | J6,J7 | you | KEEP health + activity-logs; **CUT** `/api/db-test`; de-duplicate `system/stats` (mounted twice: `app.js:274` and `tenants.js` `/system/stats`) |

---

## 3. Frontend routes and pages

One row per `<Route>` in `frontend/src/App.jsx`.

| ID | Route | Component | Purpose | LOC | Job | Owner | Proposal |
|---|---|---|---|---|---|---|---|
| F1 | `/` | `pages/Landing.jsx` | marketing page, hardcoded feature/FAQ copy | 1,160 (+1,945 css) | acquisition | you | **ASK** |
| F2 | `/shop/:slug` | `pages/Storefront.jsx` | public shop, cart, order submit | 779 | J5 | you | **ASK** |
| F3 | `/login` | `components/Login.jsx` | login | 218 | J1 | you | **KEEP** |
| F4 | `/register`, `/register-business` | `pages/Register.jsx`, `RegisterBusiness.jsx` | self-serve signup | 478 + 501 | J7 | you | **ASK** — with 3 hand-sold pilots, self-serve signup is not on the path |
| F5 | `/pricing` | `pages/Pricing.jsx` | plan cards + KHQR modal → auto unlock | 279 | J7 | you | **CUT** the QR flow; keep a static price list if it sells pilots (ASK) |
| F6 | `/help` | `pages/Help.jsx` | in-app manual | 1,112 (+1,379 css) | support | you | **ASK** |
| F7 | `/admin*` | `pages/SuperAdmin/{Dashboard,Businesses,SystemUsers}.jsx` | tenant list, system users, stats | 177+333+371 | J7 | you | **KEEP** + **ADD** "set plan / reason / audit" |
| F8 | `/dashboard` | `components/Dashboard.jsx` | today's numbers, `SalesSummary` chart | 562 + 477 (+2,578 css) | J3 | you | **KEEP** |
| F9 | `/orders`, `/orders/:id`, `/orders/new`, `/sell` | `components/Orders.jsx`, `components/sell/SellPage.jsx` | order list/detail, POS terminal, receipt PDF | 2,145 + 242 | J1,J3 | you | **KEEP** |
| F10 | `/online-orders` | `components/orders/OnlineOrders.jsx` | fulfill public orders | 394 | J5 | you | **ASK** (follows F2) |
| F11 | `/products` | `components/Products.jsx` | catalog management | 1,198 | J1,J2 | you | **KEEP** |
| F12 | `/customers` | `components/Customers.jsx` | customers + credit | 1,301 | J4 | you | **KEEP** |
| F13 | `/stock` | `components/Stock.jsx` | stock levels, receive, adjust | 924 | J2 | you | **KEEP** |
| F14 | `/suppliers` | `components/Suppliers.jsx` | suppliers | 1,126 | J4 | you | **ASK** |
| F15 | `/reports` | `components/Reports.jsx` | report tables + export | 1,035 (+803 css) | J3 | you | **KEEP** |
| F16 | `/users` | `components/Users.jsx` | staff management | 1,260 | J6 | you | **KEEP** |
| F17 | `/activity` | `components/ActivityLog.jsx` | audit log viewer | 900 (+1,205 css) | J6 | you | **KEEP** |
| F18 | `/warranty` | `components/Warranty.jsx` | warranty + service-request tabs | 1,862 (+2,394 css) | none proven | you | **ASK** |
| F19 | `/analytics` | `components/Analytics.jsx` | client-side charts from customers/products/orders (calls **no** `/api/analytics`) | 1,641 (+2,006 css) | J3 | you | **ASK** — overlaps Dashboard/Reports |
| F20 | `/profile` | `components/Profile.jsx` | account, password | 1,254 (+1,547 css) | J6 | you | **KEEP** |
| F21 | `/settings` | `pages/Settings.jsx` | store settings, receipt, storefront config | 1,684 | J1,J5 | you | **KEEP** |
| F22 | — | `components/Layout.jsx` | shell, nav, search | 413 | all | you | **KEEP** |
| F23 | - | `components/KHQRPayment.jsx` (removed in `payments-auto-v1` branch of work) | legacy KHQR component, **imported by nothing** | 285 | none | you | **CUT** |
| F24 | — | `components/BakongPayment.jsx` | plan-purchase QR modal | 248 | J7 | you | **CUT** with A11 (manual plan set) |
| F25 | — | `components/Pagination.jsx` | pagination, used only by Orders | 117 | J1 | you | **KEEP** |

---

## 4. Database objects

Evidence = `database/migrations/*` + code references (grep across `backend/src`).

| ID | Table | Purpose | Introduced | Code refs | Owner | Proposal |
|---|---|---|---|---|---|---|
| D1 | `tenants` | the shop/business; `plan`, `plan_expires_at` (023) | baseline + 023 | app, auth, dashboard, paymentRoutes, public, tenants, reconciler | you | **KEEP** (plan now set by hand) |
| D2 | `tbl_users` | login, role, `tenant_id`, `token_version`, `must_change_password` | baseline + 016/021 | app, auth, dashboard, orders, tenants, users | you | **KEEP** |
| D3 | `tbl_products` | catalog, publish flags, brand/model, images | baseline + 005/006/013 | 11 modules | you | **KEEP** |
| D4 | `tbl_categories` | categories | baseline | 7 modules | you | **KEEP** |
| D5 | `tbl_customers` | customers + credit | baseline | 8 modules | you | **KEEP** |
| D6 | `tbl_suppliers` | suppliers | baseline | 4 modules | you | **ASK** |
| D7 | `tbl_stock` | per-tenant stock, unique `(tenant_id, productid)`, non-negative check | baseline + 017 | 8 modules | you | **KEEP** |
| D8 | `tbl_stock_log` | movement audit trail | 002/003/019 | orders, products, public, stock | you | **KEEP** |
| D9 | `tbl_orders` | orders, status, `tenant_id`, `idempotency_key`, void fields | baseline + 003/005/015 | 6 modules | you | **KEEP** |
| D10 | `tbl_order_items` | line items, `buy_price`, `refunded_*` | baseline + 003/018 | 5 modules | you | **KEEP** |
| D11 | `tbl_payment` | in-store payment records | 002 | orders | you | **KEEP** |
| D12 | `tbl_activity_logs` | audit trail (used by plan marking too) | baseline + 026 | 6 modules | you | **KEEP** |
| D13 | `store_settings` | slug, storefront, opening hours | 005/012/020 | auth, public | you | **KEEP** |
| D14 | `tenant_order_counters` | per-tenant order numbering | 017 | orders, public | you | **KEEP** |
| D15 | `schema_migrations` | migration ledger (Phase 2 lives here) | baseline | none (scripts only) | you | **KEEP** |
| D16 | `tbl_orders_details` | **second** order-items table | 004 | **none** | you | **CUT** (prod DROP needs your approval) |
| D17 | `tbl_held_sales` | parked carts | 007 | **none** | you | **CUT** |
| D18 | `tbl_payment_method` | payment method list | 007 | **none** | you | **CUT** |
| D19 | `khqr_sessions` | plan-purchase QR sessions | 018/023/026 | paymentRoutes, reconciler | you | **CUT** with A11 |
| D20 | `khqr_webhook_events` | raw bank webhook payloads | 023/026 | paymentRoutes only | you | **CUT** with A11 |
| D21 | `tbl_warranty` | warranty records | 009 | warranties, tenants | you | **ASK** |
| D22 | `tbl_service_requests` | repair jobs | 009 | services, tenants | you | **ASK** |

RLS is enabled across tables by 007/009/022/023/026; the API runs as one role, so RLS is
defence-in-depth, not the access control. Not a Phase 0 change — noted for Phase 2.

---

## 5. Non-route backend modules

| ID | Module | Purpose | LOC | Referenced by | Proposal |
|---|---|---|---|---|---|
| B1 | `services/bakongVerifier.js` (removed, Phase 2) | NBC/relay Bakong transaction verification | 159 | paymentRoutes, reconciler, 2 tests | **CUT** |
| B2 | `services/bakongReconciler.js` (removed, Phase 2) | 30 s background loop marking sessions PAID | 82 | `app.js:322` `startReconciler()` | **CUT** |
| B3 | `services/paywayService.js` (removed in `3a215c5`) | ABA PayWay REST wrapper | 178 | `paymentController` only | **CUT** |
| B4 | `controllers/paymentController.js` (removed in `3a215c5`) | PayWay KHQR flow — required `../db`, which **does not exist** | 129 | **nothing** | **CUT** |
| B5 | `services/stripeService.js` (removed in `3a215c5`) | Stripe checkout + webhook | 98 | **nothing** | **CUT** |
| B6 | `services/invoiceService.js` | invoice helpers | 91 | **nothing** | **CUT** |
| B7 | `services/emailService.js` | nodemailer transport | 63 | **nothing** | **CUT** |
| B8 | `services/exportService.js` | export helpers | 22 | **nothing** | **CUT** |
| B9 | `config/plans.js` | USD prices for market-stall/shophouse/chain, 1-month only | 21 | paymentRoutes | **CUT** with A11 (prices become a page in docs, not code) |
| B10 | `models/*` (7 files, removed in `3a215c5`) | Mongoose-shaped models | 473 | **nothing** | **CUT** |
| B11 | `lib/serializers.js` (removed in `3a215c5`) | response shaping | 113 | **nothing** | **CUT** |
| B12 | `middleware/validate.js` (removed in `3a215c5`) | express-validator bundles | 160 | **nothing** | **CUT** |
| B13 | `middleware/cache.js` | in-memory cache | 27 | orders, products | KEEP |
| B14 | `middleware/auth.js` | JWT, tenant scope, role | 165 | everywhere | KEEP |
| B15 | `middleware/rolePolicy.js` | route→role policy | 29 | `app.js:234` | KEEP |
| B16 | `middleware/rateLimit.js` | limiters | 58 | app, public | KEEP |
| B17 | `middleware/activityLogger.js` | audit writes | 29 | app, several routes | KEEP |
| B18 | `scripts/` (19 files) | seeds, `_guard.js`, `verify.js`, `names-diff.js`, `flake.js`, test-DB helpers, `make-baseline.js`, mutation scripts, e2e + dev helpers | — | package.json / tests / docs | **KEEP** the referenced ones (see the table in `docs/RESTORE.md`); `perf-explain.js` was a temporary Phase 5b harness and is deleted |

Phase 2/5 correction: B3, B4, B5, B10, B11 and B12 were removed in `3a215c5`; B1, B2
and B9 were removed with the Phase 2 payment decision. B6–B8 still exist but have no
caller. The rows are kept as the Phase 0 record; `docs/RESTORE.md` has the restore commands.

Backend LOC accounted for: 4,976 (routes+app) + 822 (services) + 473 (models) + 468 (middleware)
+ 124 (lib) + 161 (config) + 69 (utils/constants) ≈ 7,093 of 7,112.

---

## 6. Requirements that look AI-invented, not customer-driven

Tested each of your six suspicions against the code. Two of the six are **not there** — I am not
going to invent deletions for them.

| # | Suspicion | Verdict | Evidence |
|---|---|---|---|
| 6.1 | Yearly plans | **NOT IN CODE** | `config/plans.js` prices only `{1: {...}}`; `period_months` accepted up to 119 (`paymentRoutes.js:53`) but only 1 is priced. No annual anywhere in frontend. Nothing to delete; the dead `period_months` branch dies with A11. |
| 6.2 | KHR pricing lists | **NOT IN CODE** | `plans.js` is USD-only; KHQR currency defaults `'USD'` (`paymentRoutes.js:48`). Nothing to delete. |
| 6.3 | Automatic plan unlock | **CONFIRMED — removed in Phase 2** | `paymentRoutes.js:150-166`, `:278-292`, `:343-352` UPDATE `tenants.plan` straight from a bank check; `bakongReconciler` does it on a 30 s timer. This is the single biggest unearned-complexity block: 241 lines + 2 tables + 21 tests, and it makes your revenue depend on an NBC API token you must renew (`scripts/renew-bakong-token.js`, removed in Phase 2). |
| 6.4 | Multiple payment gateways | **CONFIRMED — four, all removed** | Bakong direct (`bakongVerifier`), Bakong relay (`provider === 'relay'`), Stripe (`stripeService` + `@stripe/*` in the frontend), ABA PayWay (`paywayService`). Only one of them was wired to a live UI path. |
| 6.5 | Warranty / service modules | **CONFIRMED** | 4,256 frontend lines (Warranty.jsx + css), 342 backend lines, 2 tables, 2 migrations, 0 pilot interviews. |
| 6.6 | Unused tables | **CONFIRMED — 3, plus 2 that die with 6.3** | `tbl_orders_details`, `tbl_held_sales`, `tbl_payment_method` have **zero** code references. `khqr_sessions` / `khqr_webhook_events` are only used by the block in 6.3. |

Two more that smell the same way and were not on your list:

- **6.7 Duplicate order-items schema.** `tbl_orders_details` (004) and `tbl_order_items` (baseline)
  both exist; only `tbl_order_items` is read. Classic "generated a migration without checking".
- **6.8 Duplicate `system/stats` route.** `app.js:274` and `tenants.js` both serve it.
- **6.9 Self-serve signup for a product with 0 customers.** `Register.jsx` + `RegisterBusiness.jsx`
  (979 lines) + `POST /api/auth/register-client` exist to acquire users you are acquiring by hand.
- **6.10 Marketing surface before there is a market.** `Landing.jsx` (1,160 lines) advertises
  "official manufacturer warranty (1 to 3 years)" — a promise the product's warranty module
  would have to keep, for a feature no shop has asked for.

---

## 7. Totals by proposal (for your decision, not a plan of action)

| Proposal | Backend LOC | Frontend LOC | Tables | Tests that would disappear |
|---|---|---|---|---|
| KEEP | ~3,700 | ~12,600 | 15 | — |
| CUT | ~2,100 | ~530 (+21 deps) | 5 | 21 (bakongPayment 14, bakongVerifier 7) |
| ASK | ~1,300 | ~9,900 | 5 | — |

The CUT pile is mostly *not* the biggest pile by lines. The expensive thing to own is ASK
(warranty 4,256 frontend lines, storefront 1,173, help 2,491, landing 3,105), not the payment code.

---

## 8. The five questions I will ask pilot shops

Ordered so that a "no" to an early one makes later ones moot. Each maps to the modules it decides.

1. **"Walk me through the last sale you made. What did you touch — notebook, phone, calculator, nothing?"**
   Decides: F9 POS, F11 products, F8 dashboard. If the answer is "notebook", J1 is real and the
   POS must be faster than the notebook, not richer than it.

2. **"When you ran out of something last month, how did you find out — and what did you do?"**
   Decides: F13 stock, F2 low-stock alerts, F14 suppliers. Tells you whether reorder is a job or a wish.

3. **"At closing, what number do you need before you can sleep, and where does it come from today?"**
   Decides: F8 dashboard, F15 reports, F19 analytics. If the number is "cash in the drawer",
   analytics is decoration.

4. **"A customer messages you on Telegram/Facebook to buy. What happens next?"**
   Decides: F2 storefront, F10 online orders, A16 public API. This is the only job that justifies
   the storefront's 1,173 frontend lines — if the answer is "I reply and they come to the shop",
   cut it.

5. **"If the system were down for a day, what would you lose — and what would you pay per month
   to never worry about it?"**
   Decides: whether shophouse $19 / chain $49 is fiction, and whether manual plan marking is
   enough for the first 3 pilots. Also tells you if cash-only is acceptable (J1 without KHQR).

Ask these before Phase 1 is final: Q4 alone kills or keeps ~1,500 lines, Q5 prices the product.

---

## 9. Decisions I need from you (reply with IDs)

1. **A11/B1–B3/B5/B9 + D19/D20** — approve the manual-plan replacement? Proposed manual flow:
   super admin sets `tenants.plan` (market-stall / shophouse / chain) + reason, audited into
   `tbl_activity_logs`; `GET /payment/subscription` stays read-only; `git tag payments-auto-v1`
   before deletion; `RESTORE.md` records the tag. **(This is the Phase 1 headline.)**
2. **B10/B11/B12** — 746 dead lines (models, serializers, validate). Unequivocal CUT?
3. **A14** — `/api/analytics` has no caller. CUT the API, keep the page? Or CUT the page too (F19)?
4. **D16/D17/D18** — 3 unused tables. Report-only (prod DROP needs your approval) or drop in test DB now?
5. **A12/A13/D21/D22/F18** — warranty + services: KEEP if any pilot is an electronics shop, CUT otherwise. Needs Q1/Q4 answers.
6. **A16/F2/F10** — storefront + online orders: KEEP only if Q4 says orders arrive remotely.
7. **F1/F4/F5/F6** — landing, self-serve signup, pricing, help: KEEP / trim / CUT?
8. **A6/F14** — suppliers: do pilot shops track suppliers, or just buying price?
9. **A3 refunds** — is refund a pilot need, or a Phase-3 feature?
10. **Repo hygiene** — `mutant.log` (640 KB), `verify.log`, `guard.log`, `server.log`,
    `prod_backup.sql`, `database/spms.accdb` (7 MB), `database/spms.db`, `fix-api-client.mjs`,
    `backend/names.txt`, `backend/names2.txt`. Approve deletion (git removes the tracked ones;
    `.accdb`/`.db` need a decision because they may be your only data copy).
    **Phase 5:** `fix-api-client.mjs` is deleted; `.db` / `.accdb` / `prod_backup.sql` await your
    offline copy (sizes and `git log` are in the Phase 5 report). The untracked logs are untouched.

**Port:** `AGENTS.md` now matches `docker-compose.test.yml`: the host port comes from
`TEST_DB_PORT` in `backend/scripts/_guard.js` (default 55432). Nothing else to decide.

---

## 10. What I did not do in Phase 0

- No code, test, migration or dependency changed. Only this file was created.
- No commit, no branch, no tag. `lean` / `pre-lean` happen when you approve Phase 1.
- No DB container started, no suite run.
- No `.env`, connection string or lockfile-read secret quoted.
