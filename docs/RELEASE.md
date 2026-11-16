# RELEASE.md — production release plan (owner-run)

Everything on this page is run by the **owner** against the **production**
database and the Render service. The agent prints these commands; it never runs
them.

Live facts this plan is built on (the owner's read-only results):

- The migration ledger `schema_migrations` stops at `014`, but **`015` → `021`
  are already applied on production** (`must_change_password`, `token_version`,
  `voided_at/voided_by/void_reason`, `idempotency_key`, `refunded_qty/
  refunded_amount`, `stock_log.type/notes`, …). They are **not pending** and are
  not listed for re-run anywhere on this page.
- Production still **lacks** `tbl_activity_logs.details` (026) and the five
  `tenants` admin columns (028), and does not have 027's four indexes.
- **022 → 025 are owner decisions** — section 3, each with its own pre-check.
- The ledger alone is not evidence: production already has objects from `015+`
  (`tenant_order_counters`, `khqr_sessions`, `tenants.plan`, RLS on public
  tables) even though `schema_migrations` says otherwise. The combined SELECT in
  section 2 is the **only** authority on what actually exists.

Order: **backup → pre-checks → 026 → 028 → 027 (optional) → deploy code →
smoke → rollback.** The 022–025 decisions (section 3) are settled before
section 4.

---

## 1. Data backup (owner runs, before anything else)

The owner runs it with the official Postgres 17 image:

```bash
docker run --rm postgres:17-alpine \
  pg_dump --no-owner --no-privileges --format=custom "$DATABASE_URL" \
  > "spms-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

`--rm` removes the container when it exits, so the dump must be written to
**stdout** and redirected on the host — never `--file=` inside the container
(that file would be deleted with the container).

- Keep it off the database host. Verify it is readable:

  ```bash
  docker run --rm -i postgres:17-alpine pg_restore --list < spms-*.dump | head
  ```

  must list tables, not error.
- Restore practice is in `docs/RESTORE.md` / `docs/OPERATIONS.md`; restore into a
  scratch database first, never straight over production.

### 1b. Rehearse (optional but recommended)

You also need a **schema-only plain SQL** dump (the rehearse script feeds it to
`psql -f`, so it cannot be the `-Fc` custom format):

```bash
docker run --rm postgres:17-alpine \
  pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" \
  > "prod-schema-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

```bash
npm run rehearse -- path/to/prod-schema-....sql
```

(`package.json` → `"rehearse": "node backend/scripts/rehearse.js"`; header:
`node backend/scripts/rehearse.js <path-to-schema-only-prod-dump.sql>`.)

It loads the dump into a scratch `spms_rehearse_test` database **inside the local
test container only** (the guard refuses any non-127.0.0.1 URL), marks the ledger
`001-014`, runs the real runner for `015+`, and prints the schema signature diff —
that diff is the production deploy plan. Owner-run only.

---

## 2. Pre-checks (read-only; run these before touching anything)

### 2.1 Live status of 015 → 028: one combined SELECT

Every "already applied / pending" statement below is a prediction until this
returns results for the production database. `present = true` → that object
already exists there; `present = false` → that migration's work is still
pending. The live ledger stopping at `014` does **not** prove absence.

```sql
SELECT split_part(obj, ' ', 1) AS migration, obj, present
FROM (
  SELECT '015 tbl_users.chk_user_tenant' AS obj,
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_tenant' AND conrelid = to_regclass('public.tbl_users')) AS present
  UNION ALL
  SELECT '015 tbl_payment.chk_payment_status',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_status' AND conrelid = to_regclass('public.tbl_payment'))
  UNION ALL
  SELECT '015 tbl_orders.voided_at',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_orders' AND column_name = 'voided_at')
  UNION ALL
  SELECT '015 tbl_orders.voided_by',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_orders' AND column_name = 'voided_by')
  UNION ALL
  SELECT '015 tbl_orders.void_reason',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_orders' AND column_name = 'void_reason')
  UNION ALL
  SELECT '016 tbl_users.must_change_password',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_users' AND column_name = 'must_change_password')
  UNION ALL
  SELECT '017 tenant_order_counters (table)',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_order_counters')
  UNION ALL
  SELECT '017 tbl_stock.uq_tenant_product_stock',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenant_product_stock' AND conrelid = to_regclass('public.tbl_stock'))
  UNION ALL
  SELECT '017 tbl_stock.chk_stock_non_negative',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_non_negative' AND conrelid = to_regclass('public.tbl_stock'))
  UNION ALL
  SELECT '017 tbl_orders.uq_tenant_idempotency',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenant_idempotency' AND conrelid = to_regclass('public.tbl_orders'))
  UNION ALL
  SELECT '017 tbl_orders.uq_tenant_order_no',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenant_order_no' AND conrelid = to_regclass('public.tbl_orders'))
  UNION ALL
  SELECT '018 tbl_order_items.refunded_amount',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_order_items' AND column_name = 'refunded_amount')
  UNION ALL
  SELECT '018 khqr_sessions (table)',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'khqr_sessions')
  UNION ALL
  SELECT '018 idx_khqr_sessions_tenant',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_tenant')
  UNION ALL
  SELECT '018 idx_khqr_sessions_expiry',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_expiry')
  UNION ALL
  SELECT '019 tbl_stock_log.type',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_stock_log' AND column_name = 'type')
  UNION ALL
  SELECT '019 tbl_stock_log.transaction_type',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_stock_log' AND column_name = 'transaction_type')
  UNION ALL
  SELECT '019 tbl_stock_log.reference_type',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_stock_log' AND column_name = 'reference_type')
  UNION ALL
  SELECT '019 tbl_stock_log.user_id',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_stock_log' AND column_name = 'user_id')
  UNION ALL
  SELECT '019 tbl_stock_log.notes',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_stock_log' AND column_name = 'notes')
  UNION ALL
  SELECT '019 tbl_products.status',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_products' AND column_name = 'status')
  UNION ALL
  SELECT '019 idx_products_tenant_status',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_tenant_status')
  UNION ALL
  SELECT '020 store_settings.opening_hours',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'opening_hours')
  UNION ALL
  SELECT '021 tbl_users.token_version',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_users' AND column_name = 'token_version')
  UNION ALL
  SELECT '022 all public base tables have RLS (count > 0 required, else vacuously true)',
         (SELECT count(*) > 0 AND count(*) = count(*) FILTER (WHERE c.relrowsecurity)
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r')
  UNION ALL
  SELECT '022 roles anon + authenticated exist',
         (SELECT count(*) = 2 FROM pg_roles WHERE rolname IN ('anon', 'authenticated'))
  UNION ALL
  SELECT '023 tenants.plan',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plan')
  UNION ALL
  SELECT '023 tenants.plan_expires_at',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plan_expires_at')
  UNION ALL
  SELECT '023 khqr_sessions columns (18)',
         (SELECT count(*) = 18 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'khqr_sessions'
             AND column_name IN ('id','order_id','tenant_id','user_id','plan','period_months','amount',
                                 'expected_amount','currency','md5','bakong_hash','qr_string','status',
                                 'expires_at','paid_at','verified_by','raw_response','created_at'))
  UNION ALL
  SELECT '023 khqr_sessions_pkey',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'khqr_sessions_pkey' AND conrelid = to_regclass('public.khqr_sessions'))
  UNION ALL
  SELECT '023 idx_khqr_sessions_md5_unique',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_md5_unique')
  UNION ALL
  SELECT '023 idx_khqr_sessions_bakong_hash_unique',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_bakong_hash_unique')
  UNION ALL
  SELECT '023 chk_khqr_sessions_status',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_khqr_sessions_status' AND conrelid = to_regclass('public.khqr_sessions'))
  UNION ALL
  SELECT '023 khqr_webhook_events (table)',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'khqr_webhook_events')
  UNION ALL
  SELECT '023 khqr_webhook_events RLS',
         EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'khqr_webhook_events' AND c.relrowsecurity)
  UNION ALL
  SELECT '023 idx_khqr_sessions_tenant_status',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_tenant_status')
  UNION ALL
  SELECT '023 idx_khqr_sessions_status_expiry',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_khqr_sessions_status_expiry')
  UNION ALL
  SELECT '024 tbl_users.subscription_plan + subscription_expires (024 only runs if both exist)',
         (SELECT count(*) = 2 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'tbl_users'
             AND column_name IN ('subscription_plan','subscription_expires'))
  UNION ALL
  SELECT '025 no anon/authenticated in public default ACL (see note below)',
         NOT EXISTS (
           SELECT 1 FROM pg_default_acl da
             JOIN pg_namespace n ON n.oid = da.defaclnamespace
            WHERE n.nspname = 'public'
              AND (da.defaclacl::text LIKE '%anon%' OR da.defaclacl::text LIKE '%authenticated%'))
  UNION ALL
  SELECT '026 khqr_sessions.order_id nullable',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'khqr_sessions'
                    AND column_name = 'order_id' AND is_nullable = 'YES')
  UNION ALL
  SELECT '026 khqr_sessions.qr_string nullable',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'khqr_sessions'
                    AND column_name = 'qr_string' AND is_nullable = 'YES')
  UNION ALL
  SELECT '026 tbl_activity_logs.details',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tbl_activity_logs' AND column_name = 'details')
  UNION ALL
  SELECT '027 idx_order_items_order_id',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_order_items_order_id')
  UNION ALL
  SELECT '027 idx_products_tenant_id_id_desc',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_products_tenant_id_id_desc')
  UNION ALL
  SELECT '027 idx_orders_tenant_id_or_id_desc',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_orders_tenant_id_or_id_desc')
  UNION ALL
  SELECT '027 idx_orders_tenant_status_or_id_desc',
         EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_orders_tenant_status_or_id_desc')
  UNION ALL
  SELECT '028 tenants.email',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email')
  UNION ALL
  SELECT '028 tenants.phone',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'phone')
  UNION ALL
  SELECT '028 tenants.address',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'address')
  UNION ALL
  SELECT '028 tenants.settings',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'settings')
  UNION ALL
  SELECT '028 tenants.updated_at',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'updated_at')
) checks
ORDER BY 1, 2;
```

Notes on two rows:

- **022** requires at least one public base table (`count(*) > 0`), otherwise
  `count(*) = count(*) FILTER (…)` is vacuously true on an empty database.
- **025** on a Supabase-style database (this test image, and production) the
  default ACL in `public` **starts with** `anon`/`authenticated`/`service_role`
  grants, so `f` = 025 pending and `t` = applied. On a vanilla Postgres cluster
  where those grants never existed, `t` cannot be distinguished from "never
  needed" — cross-check with the 022 roles row (if the roles do not exist, 025
  was a no-op by design).

### 2.2 What to expect (owner's read-only results, already taken)

| Rows | Expected | Meaning |
| --- | --- | --- |
| `015` … `021` (20 rows) | `t` | **Applied on live — do not re-run, not pending.** |
| `022` RLS + roles | `t` | RLS on public tables and the `anon`/`authenticated` roles already exist; 022's remaining work (the REVOKEs) is a decision — section 3. |
| `023` (13 rows) | mostly `t` | `tenants.plan` / `plan_expires_at` and `khqr_sessions` already exist on live. Any `f` row = that specific index/table/constraint is still missing (the table/index rows were not in the owner's column list — treat them as UNKNOWN until this runs). |
| `024` | `f` | 024 only runs if `tbl_users.subscription_plan` + `subscription_expires` exist; they do not → no-op by design. |
| `025` | `f` | 025 pending (see the note above). Owner decision — section 3. |
| `026` (3 rows) | `f` | **Pending → apply in section 4.** Live lacks `tbl_activity_logs.details`. |
| `027` (4 rows) | `f` | Not created → optional, section 4. |
| `028` (5 rows) | `f` | **Pending → apply in section 4.** |

### 2.3 Columns the new code writes — confirm before deploying code

```sql
-- 026: order_id / qr_string nullability on khqr_sessions, and tbl_activity_logs.details
SELECT table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'khqr_sessions' AND column_name IN ('order_id','qr_string'))
    OR (table_name = 'tbl_activity_logs' AND column_name = 'details'))
ORDER BY 1,2;

-- 023: tenants.plan / tenants.plan_expires_at (subscription routes) — already present per live results
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
  AND column_name IN ('plan','plan_expires_at') ORDER BY 1;

-- 028: tenants admin columns (super-admin panel list/create/update)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
  AND column_name IN ('email','phone','address','settings','updated_at')
ORDER BY 1;   -- 5 rows = already applied, fewer = pending

-- 019: tbl_stock_log.type / .notes (every stock movement write) — already applied per live results
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tbl_stock_log'
  AND column_name IN ('type','notes') ORDER BY 1;
```

---

## 3. Owner decisions: 022 → 025 (each with its own pre-check)

These four are **not** in the section 4 apply list. Decide each one, record the
decision (and the reason if you skip), then move on.

### 022 — RLS and revoke

**Header warning, verbatim from `022_rls_and_revoke.sql`:**
**"Do NOT run on any remote/production DB. Idempotent."**
Decide whether to skip it or accept it (it
enables RLS on every table and revokes from `anon`/`authenticated`). Live already
has RLS on public tables, so the only real effect left is the REVOKEs. Check who
you are and whether those roles exist:

```sql
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated');
```

If skipped, say so in the ledger record so the reason is preserved.

### 023 — subscription ledger and plan columns

The column part (`tenants.plan`, `tenants.plan_expires_at`, the 18
`khqr_sessions` columns) already exists on live. The remaining risk is the two
UNIQUE indexes over `khqr_sessions.md5` / `.bakong_hash`, which fail on
duplicates:

```sql
SELECT md5, count(*) FROM khqr_sessions WHERE md5 IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
SELECT bakong_hash, count(*) FROM khqr_sessions WHERE bakong_hash IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
```

Any row returned = 023 would fail until cleaned up. Run 023 only for the rows
the combined SELECT shows as `f`.

### 024 — backfill tenant plan from users

Only runs if **both** `tbl_users.subscription_plan` and
`tbl_users.subscription_expires` exist; otherwise it is a no-op:

```sql
SELECT count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tbl_users'
  AND column_name IN ('subscription_plan','subscription_expires');   -- 2 = it will run, 0 = no-op
```

If it will run: it copies `tbl_users.subscription_plan` (case preserved — live
`tenants.plan` is mixed `'FREE'`/`'free'`) into `tenants.plan`. **No data update
is proposed for live here; the owner decides whether to run it at all.** All
reads of `tenants.plan` are case-insensitive either way (11a-fix step 3b).

### 025 — revoke default privileges

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
```

Use the `025` row of the combined SELECT as the pre-check and read it with the
note in section 2.1 (`f` = pending on a Supabase-style database).

---

## 4. Apply the pending migrations (production, applied by hand, in filename order)

`backend/scripts/run_migration.js` **cannot** target production: `backend/scripts/_guard.js`
refuses any URL that is not `127.0.0.1:<test port>/*_test` (or dev mode). Apply
each reviewed file manually with `psql`, one file at a time, **one transaction
each**:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f database/migrations/026_hardening_and_ledger.sql
```

`-1` = single transaction, `ON_ERROR_STOP=1` = stop at the first error. After each
file succeeds, record it so later runs skip it (same table the runner uses):

```bash
psql "$DATABASE_URL" -c "INSERT INTO schema_migrations (filename) VALUES ('026_hardening_and_ledger.sql') ON CONFLICT DO NOTHING;"
```

Files, in order (this is the whole pending list — `015` → `021` are already
applied on live and `022` → `025` are section 3 decisions):

```
026_hardening_and_ledger.sql          028_tenants_admin_columns.sql
027_perf_list_indexes.sql             ← optional, see below
```

### 4.1 026 — hardening and ledger (required)

Idempotent (`IF EXISTS` / `ADD COLUMN IF NOT EXISTS`):

- `khqr_sessions.order_id` and `.qr_string` DROP NOT NULL (subscription
  sessions have no order);
- `tbl_activity_logs.details TEXT` — **the one column live is missing**; the
  manual mark-paid route writes `details` in the same transaction, so this must
  be applied before the code deploy.
- `khqr_webhook_events` is intentionally **not** created here (the webhook route
  was deleted); 023 still creates it on the replay path, so skipping it is a
  no-op for databases that ran 023.

### 4.2 028 — tenants admin columns (required, revised)

`backend/src/routes/tenants.js` and `frontend/src/pages/SuperAdmin/Businesses.jsx`
read/write these five columns; without them every `GET ?search=`, `POST` and
`PUT /api/tenants` fails with SQLSTATE 42703. Additive and idempotent:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"theme": "light"}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
```

**Deliberately not created** (owner decision, 11a-fix step 2): `subscription_plan`
(duplicates `tenants.plan` from 023 — the routes and the super-admin UI now use
`plan`), and `max_users` / `max_products` (nothing enforces them anywhere;
the DB defaults 5/100 advertised limits that never existed).

### 4.3 027 — list indexes (optional)

Four `CREATE INDEX IF NOT EXISTS` statements. Measured on 50 tenants × 100
products × 400 orders (scratch DB, `EXPLAIN ANALYZE BUFFERS`, median of 5):

| Query | Before | After | |
| --- | --- | --- | --- |
| order detail `WHERE order_id = $1` | 1.158 ms | 0.027 ms | 43× |
| products list `WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20` | 1.278 ms | 0.044 ms | 29× |
| orders list `WHERE tenant_id=$1 ORDER BY or_id DESC LIMIT 20` | 3.077 ms | 0.071 ms | 43× |
| orders status `WHERE tenant_id=$1 AND status=$2` | 0.430 ms | 0.114 ms | 3.8× |

Safe to skip on a small database; `IF NOT EXISTS` makes a re-run a no-op. On a
large table the CREATE INDEX takes a write lock for the build — run it in a
maintenance window.

---

## 5. Deploy the code

- **Pre-flight:** section 2.3 must return the 026 and 028 rows before this —
  the new code writes `tbl_activity_logs.details` (mark-paid) and the five
  `tenants` columns (super-admin panel).
- Tag first (`git tag pre-release-<date>`; existing tags are listed in
  `docs/RESTORE.md`), then deploy that tag. `render.yaml` deploys
  `spms-backend` from `backend/`.
- `npm run verify` must be green before the tag (see `docs/OPERATIONS.md`).
- Health check: `GET /health` → `"db": "connected"`.

## 6. Smoke checklist (after deploy, in this order)

1. **Login** (tenant user and super admin).
2. **Create product**.
3. **Receive stock** (stock movement is logged).
4. **Sell** (POS checkout; order number allocated from `tenant_order_counters`).
5. **Dashboard totals** (today's sales/refunds match the sale just made).
6. **Super-admin panel** (business list + search + edit a tenant — needs the 028
   columns; a tenant plan saved from the panel comes back lowercase).
7. **Manual mark-paid** (super admin marks a KHQR session paid — writes
   `khqr_sessions`, `tenants.plan` (lowercase) and `tbl_activity_logs.details`
   in one transaction; procedure in `docs/OPERATIONS.md`). Expiry is computed in
   UTC regardless of the DB session time zone.

## 7. Rollback

- **Code:** redeploy the previous git tag. The backend is stateless; the previous
  build is safe as soon as it starts.
- **Database:** no down-migrations exist and none are needed — `026`, `028` and
  `027` (and `022` → `025`, if applied) are additive and idempotent, so old code
  keeps working against the newer schema. Never drop a column as a "rollback":
  write a new forward migration that reverses it and rehearse it first (1b).

---

## Environment variable NAMES (Render dashboard)

**Set:**

| Name | Why |
| --- | --- |
| `DATABASE_URL` | required by `backend/src/config/env.js`; remote host is allowed because the Render platform sets `RENDER=true` (`backend/src/config/postgres.js:44`) |
| `JWT_SECRET` | required by `env.js` |
| `CORS_ORIGINS` | required by `env.js` in production |
| `NODE_ENV` | `production` (already in `render.yaml`) |
| `PORT` | `5000` (already in `render.yaml`) |
| `BAKONG_ACCOUNT_ID` | KHQR account (`render.yaml`, sync: false) |
| `BAKONG_MERCHANT_NAME` | KHQR merchant (`render.yaml`, sync: false) |
| `BAKONG_MERCHANT_CITY` | KHQR merchant (`render.yaml`, sync: false) |
| `LOG_LEVEL` | optional; logger default is `info` |
| `PLANS_CONFIRMED` | **owner sets it, only after confirming prices** — `paymentRoutes.js:61` returns 503 until it is `true`; intentionally left unset in `render.yaml:20` |

Optional, currently read only by `env.js` (no other code reference):
`FRONTEND_URL`, `SMTP_USER`, `SMTP_PASS`, `DB_SSL` (SSL already enabled when
`NODE_ENV=production`).

**Delete (no code references them):**

```
BAKONG_PROVIDER        BAKONG_API_BASE        BAKONG_TOKEN*
KHQR_RBK_TOKEN         BAKONG_RELAY_*         KHQR_WEBHOOK_SECRET
ENABLE_PAYMENT_SIMULATOR                      STRIPE_*
```

`STRIPE_*` appears only in `.env.example` and the optional list in
`backend/src/config/env.js`; nothing calls Stripe.
