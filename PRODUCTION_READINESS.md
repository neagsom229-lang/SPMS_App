# PRODUCTION_READINESS.md — SPMS / KhmerFlow (final production-readiness pass)

Date: 2026-11-19 (final pass) · Scope: public storefront catalog + owner journey

## Musk 5-step scorecard

| Step | Verdict | Evidence |
|---|---|---|
| 0 – Understand | DONE | Flow map + hardcoded/mock inventory produced this pass (below) |
| 1 – Make requirements less dumb | DONE | KEEP / FIX / DELETE / DEFER table produced this pass (below) |
| 2 – Delete | MOSTLY DONE | Static storefront catalog + PK-recycling seed logic removed this pass |
| 3 – Simplify & make real | IN PROGRESS | 3a storefront→DB DONE; 3b–3h partially verified/implemented |
| 4 – Accelerate cycle time | DONE | `npm run verify`, `npm run test:e2e`, `npm run gen:images`, `npm run db:dev:seed` all working |
| 5 – Automate | PARTIAL | unit/e2e smoke present; new risk suites (tenant isolation, stock concurrency, webhook, a11y, load) NOT yet added |

## Step 0 – What was hardcoded / mocked / demo (item | where | real replacement | status)

| # | Item | Where | Real replacement | Status after pass |
|---|---|---|---|---|
| 1 | 20 demo products rendered from a JS file | `frontend/src/data/products.js` (storefront render path) | Per-tenant products via `GET /api/public/store/:slug/menu` | **FIXED THIS PASS** — storefront now loads from DB; data file retained only as demo-seed + image-source |
| 2 | Exchange rate hardcoded (1 USD = 4,000 KHR) | `frontend/src/data/products.js`, storefront fallback | Per-tenant `store_settings.exchange_rate` (store fetched per slug) | **FIXED THIS PASS** — storefront reads `store.exchange_rate` (fallback 4000) |
| 3 | Store creation writes hardcoded `exchange_rate = 4000` | `backend/src/routes/auth.js` (tenant signup) | Per-tenant value set during shop setup | OPEN (minor) |
| 4 | Demo seed products | `backend/scripts/seed-demo.js` | Real catalog seeded via catalog file for LOCAL demo only | DONE (fresh-path compliant, no PK recycling) |
| 5 | Manual Bakong KHQR "mark paid" without signature verification | `backend/src/routes/paymentRoutes.js` | Signed webhook + idempotent apply + audited super-admin manual action | PARTIAL — manual action exists (writes audit log); webhook NOT built |
| 6 | Placeholder SVG images | `frontend/public/images/products/*.svg` (generated) | Storage adapter (local dev disk / object storage) | DONE for demo (generated SVGs); production adapter OPEN |
| 7 | Sample/demo text | various | Real copy | DONE (catalog copy real; generic UI copy acceptable) |

## Step 1 – Requirements: KEEP / FIX / DELETE / DEFER-WITH-REASON

| Flow / item | Real requirement | Decision |
|---|---|---|
| Storefront catalog source | Owner adds/edits products per tenant; storefront shows them | KEEP (implemented DB-driven this pass) |
| Prices & KHR | USD + per-tenant KHR rate, rounded, no float drift | KEEP (frontend now `Math.round(price*rate)`; backend numeric) |
| Stock | Owner sets stock; POS decrement; insufficient → reject | KEEP (server-side recompute present) |
| POS sale | Cashier sells; stock decrements; held sales/refunds | KEEP |
| Online order + payment | Real KHQR verify or audited manual mark | KEEP (partial: manual only) |
| Reports/dashboards | Asia/Phnom_Penh day boundaries, USD totals | KEEP (needs final check) |
| Super-admin plans | Stripe/Bakong plans | KEEP |
| Demo data | Local-only demo | KEEP (local-only, optional) |

## Step 2 – Deleted this pass

- Storefront render path reading `PRODUCTS` from file → now reads tenant DB via public endpoints.
- Seed PK-recycling branch → replaced with deactivate-old/insert-new (compliant) then dev DB reset via clean fresh path.
- Dead placeholder text paths.

## Step 3 – Make real status

- 3a Storefront DB-driven: **DONE** (this pass; live-verified: 20 products, filters, sort, images, KHR, add-to-cart, checkout, out-of-stock, mobile 360px).
- 3b Server-side pricing: **VERIFIED IN CODE** (checkout re-reads price from DB, ignores client price, rejects unknown/inactive, stock-checked) — still needs concurrency/idempotency tests.
- 3c Product admin (add/edit/deactivate, barcode/SKU, stock, image upload): **PARTIAL** (admin CRUD exists; image upload path exists for customers; product image upload pending confirmation).
- 3d Money/time: **PARTIAL** (numeric + `Math.round` KHR done; Asia/Phnom_Penh day boundaries + receipt consistency still to verify in reports).
- 3e Payments: **PARTIAL** (manual mark-paid audited exists; signed webhook + idempotency missing).
- 3f Security: **DONE** (JWT_SECRET required, ALLOW_REMOTE_DB guard, DB_SSL, CORS from env, rate limits, forced password, RLS migrations present).
- 3g Data safety: **OPEN** (backup/restore scripts not present in `backend/scripts`).
- 3h Seed: **DONE** (local-only, fresh-path, no recycling, idempotent).

## Step 4 – Accelerate cycle time

| Command | Status |
|---|---|
| `npm run dev` | PASS locally |
| `npm run verify` | PASS (jest 200/200, lint, build, audit, gitleaks, `verify:store`) |
| `npm run test:e2e` | 69/70 pass; 1 env-caused failure (register rate limit 20/hr/IP exhausted) |
| `npm run gen:images` | PASS (20 SVGs) |
| `npm run db:dev:seed` | PASS (refresh + reset) |

## Step 5 – Automate status (not yet done this pass)

- Tenant isolation matrix — OPEN
- Stock concurrency (N parallel checkouts → 1 wins) — OPEN
- Checkout idempotency / price-tamper — OPEN
- Refund restores stock/totals — OPEN
- Webhook bad-signature/replay — OPEN (webhook not built)
- Role matrix — covered by existing e2e partially
- Money/time rounding & day boundaries — OPEN
- Backup→wipe→restore round trip — OPEN (no backup scripts)
- Fresh-tenant Playwright journey — OPEN
- axe-core a11y — OPEN
- Load smoke — OPEN

## REAL / MANUAL / MOCKED (acceptance table)

| Capability | State |
|---|---|
| Real (automated-verified) | Catalog data path, filters/sort/search, images, KHR math, add-to-cart, out-of-stock, checkout e2e, server-side pricing code, lint/build/jest/e2e smoke, security guards |
| Manual (owner) | Bakong real payment confirmation, refunds, super-admin plan changes, production deploy |
| Mocked / demo-only | Demo seed data, generated SVGs, KHQR manual mark-paid, exchange-rate fallback, demo admin credentials |

## Remaining risks / blockers for a first paying customer

1. Bakong KHQR signed webhook + idempotency not implemented (only audited manual mark-paid exists).
2. Backup/restore scripts missing (`pg_dump`/`pg_restore` round trip not automated).
3. Fresh-tenant end-to-end owner journey (Playwright) not yet added.
4. Tenant isolation matrix not yet added as automated tests.
5. Stock-concurrency + checkout idempotency tests not yet added.
6. axe-core accessibility suite not yet added.
7. Per-tenant exchange-rate write path in shop setup not yet surfaced in UI (backend default hardcoded at signup).

## Deploy checklist (Render + hosted Postgres) — NO DEPLOY PERFORMED

- Migrations in order: 022, 025 before 026 (RLS/revoke before hardening/ledger); new additive migrations only (next: 031+).
- Env: DATABASE_URL (TLS), DB_SSL=true, DB_SSL_CA (Supabase CA PEM or value), JWT_SECRET (strong, not default), CORS_ORIGINS, NODE_ENV=production, ALLOW_REMOTE_DB unset.
- Backup before deploy (pg_dump); rollback note per migration.
- Demo seed local-only.

## Honest verdict from this pass

- `npm run verify`: **PASS** (jest 200/200, lint 0, build ✓, audit ✓, gitleaks ✓, `verify:store` PASS).
- `npm run test:e2e`: **69/70 pass** (1 env-caused rate-limit failure, re-runnable after the 1-hour window clears).
- Live storefront verified via headless browser: catalog, images, KHR, filters, sort, add-to-cart, out-of-stock, checkout, mobile 360px — **all pass**, no console errors, no failed requests.
- Overall system status: **MOSTLY READY** for a first paying customer for the storefront/POS core; **NOT READY** until the remaining items above (notably real KHQR webhook, backup/restore, fresh-tenant journey, isolation/concurrency tests) are closed.
