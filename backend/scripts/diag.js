require("dotenv").config();
const bcrypt = require("bcryptjs"); const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const tbl = await p.query("select count(*)::int as n from information_schema.tables where table_schema = $1 and table_type = $2", ["public", "BASE TABLE"]);
  console.log("public tables:", tbl.rows[0].n, "(should be about 20 or more)");
  console.table((await p.query("select tenant_id, count(*)::int as products from tbl_products group by 1 order by 1")).rows);
  console.log("tenants, users and store settings:");
  console.table((await p.query("select t.id, t.subdomain, (select count(*)::int from tbl_users u where u.tenant_id = t.id) as users, (select string_agg(s.slug, \x27,\x27) from store_settings s where s.tenant_id = t.id) as store_slug from tenants t order by t.id")).rows);
  console.log("users of the qa tenants:");
  console.table((await p.query("select tenant_id, username, email, role, status from tbl_users where tenant_id in (select id from tenants where subdomain like $1)", ["qa-%"])).rows);
  const u = await p.query("select password from tbl_users where username = $1 and tenant_id = (select id from tenants where subdomain = $2)", ["admin", "demo"]);
  console.log("demo admin password matches .env:", u.rows.length ? await bcrypt.compare(process.env.SEED_ADMIN_PASSWORD || "", u.rows[0].password) : "no admin row");
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
