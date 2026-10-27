ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Migration 012: Backfill store_settings and default category for existing tenants
-- Idempotent and non-destructive

INSERT INTO store_settings (tenant_id, slug, store_name, currency, exchange_rate, is_open, accepts_online_orders, delivery_enabled, pickup_enabled, created_at, updated_at)
SELECT t.id, t.subdomain, t.name, 'USD', 4000, true, true, false, true, NOW(), NOW()
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM store_settings s WHERE s.tenant_id = t.id OR s.slug = t.subdomain
)
ON CONFLICT (slug) DO NOTHING;

-- Also ensure every tenant has at least a default "General" category if none exists
INSERT INTO tbl_categories (name, tenant_id, created_at)
SELECT 'General', t.id, NOW()
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_categories c WHERE c.tenant_id = t.id
);
