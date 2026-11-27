-- 028_tenants_admin_columns.sql
--
-- backend/src/routes/tenants.js and frontend/src/pages/SuperAdmin/Businesses.jsx
-- were written against tenants columns this schema never created. Against the
-- pre-028 schema every one of these failed with SQLSTATE 42703
-- (column "email" does not exist):
--   GET  /api/tenants?search=...   (search clause)
--   POST /api/tenants              (duplicate-email check + INSERT)
--   PUT  /api/tenants/:id          (UPDATE ... SET)
--
-- Additive and idempotent: every statement is IF NOT EXISTS / ADD COLUMN, so it
-- is a no-op on a database that already has the columns. Nothing here is
-- required by the billing path, which keeps using tenants.plan /
-- tenants.plan_expires_at (migration 023).
--
-- Deliberately NOT created here (owner decision, 11a-fix step 2):
--   - tenants.subscription_plan: duplicated tenants.plan (023). Both routes and
--     the super-admin UI now read/write tenants.plan.
--   - tenants.max_users / tenants.max_products: no code enforces them anywhere
--     (git grep over backend/src and frontend/src shows only the tenants route
--     round-tripping them) and the UI has no field for them. The DB defaults
--     (5 / 100) implied limits that never existed, so the columns are dropped
--     from this migration and removed from the route.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"theme": "light"}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
