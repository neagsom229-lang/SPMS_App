# FLOW VERIFICATION — SPMS / KhmerFlow (local test-db run)

Date: 2026-11-20  
Scope: purchase/supplier stock receive, POS-order DB state, public checkout → owner confirmation → completion, refund, validation/API contract, tenant isolation, placeholder/offline-fallback removal.  
Database: local disposable Postgres test container only (`spms_test`, `127.0.0.1:15432`, Docker). No remote/live database was used. Reports below are raw command output excerpts only.

## 1) Root-cause evidence (purchase flow)

**Observed contract mismatch (pre-fix, from investigation):**
- `GET /api/products` returns real product fields including `id`, `name`, `price` (aliased as `saleout_price` in responses), `qtyavailable` / stock fields.
- `frontend/src/components/Orders.jsx` read purchase picker/product values using mismatched keys (e.g. `p.PRODUCT_ID || p.product_id` instead of `id`, and did not normalize the DB shape), producing `undefined` ids in the UI.
- Resulting purchase payload carried `product_id: undefined` / stringified bad values → server validation failed (`400 {"error":"Invalid product ID or quantity"}` in the old shape) → the UI caught the error and executed a local/offline fallback path (“saved locally”, fake local order/cache UI), so the user saw a fake success while no real DB order/stock change occurred.

**Server contract (authoritative):** `POST /api/orders` expects `customer_id` (positive integer, tenant-scoped) and `items[]` with `product_id` and `qty` (whole number, 1..100000), optional `discount`, `payment_method`, and `idempotency_key`. Duplicate line items → 409; insufficient stock / missing stock row → 409; success creates a `Completed` order, decrements stock atomically, writes stock log and payment rows.

## 2) Fixes applied (before → after)

### Frontend (Orders purchase)
- **Before:** mismatched product/customer field reads; offline/local fallback on API failure; `persistOrderLocally` / fallback data / “saved locally” / local-cache UI paths; no idempotent mutation contract for purchase.
- **After:** `frontend/src/api/list.js` normalizes API rows (`id`/`name`/`saleout_price`/`qtyavailable` etc.). `frontend/src/components/Orders.jsx` uses normalized pickers and sends a real DB-backed payload via React Query `useMutation`:
  - payload: `{ customer_id: Number(...), items: [{ product_id: Number(...), qty: Number(...), unit_price: Number(...), discount: Number(...) }], discount: Number(...), payment_method, idempotency_key: crypto.randomUUID() }`
  - on failure: surfaces `getErrorMessage(error)` to the user, **keeps the form open**, and **never creates a fake/local order**.
  - on success: stores the server order (`or_id`/`order_no`), refreshes products/orders from the server (stock reflected from DB).
  - save/delete flows also require real server success (no local fallback).
- Removed strings/paths: `Purchase API failed, saving locally`, `Order saved locally (API unavailable)`, `persistOrderLocally`, `getFallbackCustomers/Products`, `orders-list-offline-badge`, `Clear local cache`.

### Backend (orders API)
- **Before:** generic `400 {"error":"Invalid product ID or quantity"}` / `"Invalid customer"` / `"Customer not found"`; discount message casing loose; 500s could return `error.message` (internal leak).
- **After (field-specific, stable):**
  - `400 {"error":"customer_id must be a positive integer"}`
  - `400 {"error":"customer_id <n> was not found in this tenant"}`
  - `400 {"error":"items[i].qty must be a whole number"}`
  - `400 {"error":"items[i].product_id must be a positive integer"}`
  - `400 {"error":"items[i].qty must be a positive integer between 1 and 100000"}`
  - `400 {"error":"discount must be between 0 and the order subtotal"}`
  - `409 {"error":"Duplicate line items in cart"}` (detected with numeric product-id normalization)
  - `409 {"error":"Product ID <n> not found in stock"}` / insufficient-stock messages unchanged in meaning
  - 500 responses return generic messages only (e.g. `{"error":"Failed to create order"}`, `Failed to process refund`, `Failed to update order status`, `Failed to void order`, `Failed to process order cancellation`) — no `error.message` leak.

### UI placeholders / quality
- Replaced banned/ambiguous UI fallbacks (e.g. `Unknown`/`N/A` string fallbacks, demo placeholders) with explicit recorded states (“No name recorded”, “No product sales yet”, “No date”, “No status”, etc.) and removed fake local/offline purchase UX. Added `react/jsx-key: error` and `react/no-array-index-key: warn` and resolved lint warnings.

## 3) DB-state verification (new tests, local test DB)

New test files added (tests only; no existing tests modified):
- `backend/tests/flowVerification.test.js` — supplier stock receive increases `tbl_stock.qtyavailable` and writes `RESTOCK` log; purchase persists `tbl_orders`/`tbl_order_items`, decrements stock, writes `SALE` log and `COMPLETED` payment; idempotency-key replay returns original order without a second stock decrement; refund restores stock and marks payment refunded; public checkout stores a `Pending` `ONLINE` order, decrements stock once and logs `ONLINE_ORDER`, respects store tax in total; owner status transitions `Confirmed→Preparing→Ready→Completed` record payment without extra stock change; tenant isolation (cross-tenant order read denied, cross-tenant customer rejected with no foreign-tenant row change via `expectDenied`).
- `backend/tests/purchaseValidation.test.js` — asserts the field-specific 400 error shapes above for bad customer id, missing tenant customer, bad product id, non-integer qty, out-of-range qty, and invalid discount.
- `backend/tests/noPlaceholderScan.test.js` — scans `frontend/src` to forbid `persistOrderLocally`, `getFallbackCustomers/Products`, “Purchase API failed, saving locally”, “Order saved locally”, offline-badge/local-cache strings, `>Unknown<`, `|| 'Unknown'/'N/A'/'undefined'`, and demo placeholders.

Targeted run of the new suites (raw excerpt):
```
PASS tests/flowVerification.test.js (69.029 s)
PASS tests/purchaseValidation.test.js
PASS tests/noPlaceholderScan.test.js
Test Suites: 3 passed, 3 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        75.881 s
Ran all test suites within paths "tests/flowVerification.test.js", "tests/purchaseValidation.test.js", "tests/noPlaceholderScan.test.js".
worker databases dropped: 1
```

## 4) Pipeline / checks (raw excerpts)

`npm run verify` (local test DB container, `spms_test` on 127.0.0.1:15432):
```
=== 1/7 test database ===
=== 2/7 jest --runInBand ===
Test Suites: 24 passed, 24 total
Tests:       221 passed, 221 total
=== 3/7 test-name gate (HEAD) ===
...
  frontend: 0 lint errors
=== 5/7 frontend build ===
...
=== 6/7 npm audit (omit=dev, high) ===
  .: no high/critical advisories in production dependencies
  backend: no high/critical advisories in production dependencies
  frontend: no high/critical advisories in production dependencies
=== 7/7 secret scan ===
scanner: gitleaks 8.30.1 (git history, --redact)
...
✅ ALL VERIFICATION CHECKS PASSED (136.7s)
verify:store PASS — 20 products, 7 categories, 4 price ranges, images < 150 KB, 1 USD = 4000 KHR
```
(names gate compared against committed HEAD; verify wrote `backend/tests/expected-names.proposed.txt` per its normal behavior — `backend/tests/expected-names.txt` was not edited.)

`frontend` lint/build during this session (earlier raw): `npm run lint` exit 0, 0 errors 0 warnings; `npm run build` exit 0, `✓ built in 36.86s`.

`npm run test:dev-smoke` (script added: `node backend/scripts/smoke-local.js`): failed in this environment because no local dev servers/DB were running.
```
smoke target: http://127.0.0.1:5000/api (database spms_db on 127.0.0.1:5432)
smoke:local FAILED: fetch failed
```

`npm run test:e2e` (Playwright, local e2e servers managed by `backend/scripts/e2e-servers.js`, loopback only): run produced a mixed result with widespread login/navigation failures in this environment.
```
  21 failed
    [chromium] › e2e\golden-path.spec.js:53:1 › golden path: product -> stock -> sale -> order -> dashboard 
    [chromium] › e2e\golden-path.spec.js:196:1 › fresh tenant dashboard shows the empty state ──────
    [chromium] › e2e\golden-path.spec.js:221:1 › forced password change: blocked until a new password is set 
    ...
  49 passed (14.4m)
```
Representative failure mode (raw excerpt): login did not reach `/dashboard` (`Expected pattern: /\/dashboard/`, `Received string: "http://127.0.0.1:4173/login"`). This run did not constitute a clean green e2e pass in this environment; see raw output for full details.

## 5) Final verdict

- **Purchase flow (root cause fixed):** frontend now sends normalized, DB-compatible purchase payloads with idempotency and no local/offline fake-success fallback; backend validates with field-specific errors and never leaks internals on 500. Verified against real DB rows (order/items/payment/stock/log) in `flowVerification.test.js` and `purchaseValidation.test.js`.
- **Supplier receive / stock correctness:** `POST /api/stock/receive` increases stock and logs RESTOCK (DB-verified).
- **Public checkout → confirm → complete:** Pending ONLINE order stored with correct total/tax, stock decremented once, ONLINE_ORDER logged, status transitions applied, completion records payment (DB-verified).
- **Refund / tenant isolation:** refund restores stock and payment state; cross-tenant access/creation guarded (DB/expectDenied-verified).
- **Local verification pipeline:** `npm run verify` passed all checks in this run (jest 24 suites / 221 tests, lint, build, audit, gitleaks, store verify) against the local test DB.
- **Not fully green in this environment:** `npm run test:dev-smoke` could not run without dev servers/DB; `npm run test:e2e` reported 21 failures and 49 passes with login-redirect symptoms in this environment and requires follow-up/investigation in a clean e2e run.

No commits were made. `backend/tests/expected-names.txt` and applied migrations were not edited. No remote database was used.
