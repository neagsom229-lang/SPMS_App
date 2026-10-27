require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const q = "select t.id, t.subdomain, (select count(*)::int from tbl_users u where u.tenant_id = t.id) as users, (select count(*)::int from tbl_products x where x.tenant_id = t.id) as products, (select count(*)::int from tbl_orders o where o.tenant_id = t.id) as orders, (select count(*)::int from tbl_customers c where c.tenant_id = t.id) as customers, case when t.subdomain ~ $1 then $2 else $3 end as kind from tenants t order by t.id";
  console.table((await p.query(q, ["^(qa|sec|esc|rl)-", "TEST", "keep?"])).rows);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
