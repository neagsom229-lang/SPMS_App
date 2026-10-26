require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.table((await p.query("select p.id, p.tenant_id, p.name, p.status, p.is_published, p.stock, s.qtyavailable, s.tenant_id as stock_tenant from tbl_products p left join tbl_stock s on s.productid = p.id where p.tenant_id > 4 order by p.id desc limit 5")).rows);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
