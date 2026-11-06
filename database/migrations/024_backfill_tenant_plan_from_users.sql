-- 024_backfill_tenant_plan_from_users.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tbl_users' 
      AND column_name IN ('subscription_plan', 'subscription_expires')
    GROUP BY table_name
    HAVING count(*) = 2
  ) THEN
    EXECUTE $sql$
      WITH latest_subs AS (
        SELECT DISTINCT ON (tenant_id) tenant_id, subscription_plan, subscription_expires
        FROM tbl_users
        WHERE tenant_id IS NOT NULL AND subscription_plan IS NOT NULL AND subscription_expires > NOW()
        ORDER BY tenant_id, subscription_expires DESC
      )
      UPDATE tenants t
      SET plan = ls.subscription_plan,
          plan_expires_at = ls.subscription_expires
      FROM latest_subs ls
      WHERE t.id = ls.tenant_id
        AND (t.plan IS NULL OR LOWER(t.plan) IN ('free','market-stall') OR t.plan = '');
    $sql$;
  END IF;
END $$;
