require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const c = await p.query("select column_name from information_schema.columns where table_schema = $1 and table_name = $2", ["public", "store_settings"]);
  console.log("store_settings has updated_at:", c.rows.map((r) => r.column_name).includes("updated_at"));
  const ix = await p.query("select indexdef from pg_indexes where schemaname = $1 and tablename = $2", ["public", "store_settings"]);
  console.log("unique index on slug:", ix.rows.some((r) => /UNIQUE/i.test(r.indexdef) && /\(slug\)/.test(r.indexdef)));
  const m = await p.query("select count(*)::int as n from tenants t where not exists (select 1 from store_settings s where s.tenant_id = t.id)");
  console.log("tenants without a store row:", m.rows[0].n);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
