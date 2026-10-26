require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log("product 81:", JSON.stringify((await p.query("select id, tenant_id, name, status from tbl_products where id = $1", [81])).rows));
  console.log("stock row for 81:", JSON.stringify((await p.query("select id, productid, tenant_id, qtyavailable from tbl_stock where productid = $1", [81])).rows));
  console.log("newest products:"); console.table((await p.query("select id, tenant_id, name, status from tbl_products order by id desc limit 4")).rows);
  console.log("foreign keys that point at tbl_products:"); console.table((await p.query("select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint where contype = $1 and confrelid = $2::regclass", ["f", "tbl_products"])).rows);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
