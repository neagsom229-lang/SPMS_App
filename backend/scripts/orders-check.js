require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.table((await p.query("select or_id, order_no, status, total, source, created_at from tbl_orders order by or_id")).rows);
  console.table((await p.query("select order_id, product_id, qty, unit_price, buy_price, refunded_qty, refunded_amount from tbl_order_items order by order_id")).rows);
  console.table((await p.query("select id, name, price, cost from tbl_products where id in (61,80)")).rows);
  await p.end();
})().catch(e => { console.log("FAILED:", e.message); process.exit(1); });
