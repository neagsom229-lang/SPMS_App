require("dotenv").config();
const { Pool } = require("pg");
const base = "http://localhost:5000";
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const rows = (await p.query("select t.id, s.slug, (select count(*)::int from tbl_categories c where c.tenant_id = t.id) as cats from tenants t left join store_settings s on s.tenant_id = t.id order by t.id")).rows;
  await p.end();
  for (const r of rows) {
    if (!r.slug) { console.log("tenant " + r.id + ": NO STORE ROW"); continue; }
    const a = await fetch(base + "/api/public/store/" + r.slug);
    const m = await fetch(base + "/api/public/store/" + r.slug + "/menu");
    const j = await m.json().catch(() => ({}));
    console.log("tenant " + r.id + " slug=" + r.slug + " store=" + a.status + " menu=" + m.status + " products=" + (j.products ? j.products.length : "?") + " categories_in_db=" + r.cats);
  }
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
