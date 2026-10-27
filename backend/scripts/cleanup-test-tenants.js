require("dotenv").config();
const { Pool } = require("pg");
const EXECUTE = process.argv.includes("--execute");
const PATTERN = "^(qa|sec|esc|rl)-";
const FIRST = ["tbl_order_items", "tbl_orders_details", "tbl_payment", "tbl_stock_log", "tbl_held_sales", "tbl_warranty", "tbl_service_requests", "tbl_orders", "tbl_stock", "tbl_products", "tbl_customers", "tbl_categories", "tbl_suppliers", "tbl_payment_method", "tbl_activity_logs", "store_settings"];
(async () => {
  const p = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const t = await p.query("select id, subdomain from tenants where subdomain ~ $1 order by id", [PATTERN]);
  const ids = t.rows.map((r) => r.id);
  console.log("test tenants matched: " + ids.length + (ids.length ? " (ids " + ids[0] + " to " + ids[ids.length - 1] + ")" : ""));
  if (!ids.length) { await p.end(); return; }
  if (t.rows.some((r) => r.subdomain === "demo")) throw new Error("demo matched, refusing");
  if (ids.length > 100) throw new Error("too many matches, refusing");
  const c = await p.query("select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name where c.table_schema = $1 and c.column_name = $2 and t.table_type = $3", ["public", "tenant_id", "BASE TABLE"]);
  const have = c.rows.map((r) => r.table_name).filter((n) => n !== "tenants");
  const steps = [];
  const legacy = (await p.query("select column_name from information_schema.columns where table_schema = $1 and table_name = $2", ["public", "tbl_orders_details"])).rows.map((r) => r.column_name);
  const legacyJoin = legacy.length > 0 && !legacy.includes("tenant_id") && legacy.includes("or_id");
  if (legacyJoin) steps.push({ name: "tbl_orders_details (via orders)", where: "from \"tbl_orders_details\" where or_id in (select or_id from tbl_orders where tenant_id = any($1))" });
  for (const n of FIRST) if (have.includes(n)) steps.push({ name: n, where: "from \"" + n + "\" where tenant_id = any($1)" });
  for (const n of have) if (!FIRST.includes(n) && n !== "tbl_users") steps.push({ name: n, where: "from \"" + n + "\" where tenant_id = any($1)" });
  if (have.includes("tbl_users")) steps.push({ name: "tbl_users", where: "from \"tbl_users\" where tenant_id = any($1)" });
  const rows = [];
  for (const s of steps) {
    const r = await p.query("select count(*)::int as n " + s.where, [ids]);
    rows.push({ table: s.name, rows: r.rows[0].n });
  }
  console.table(rows);
  if (!EXECUTE) { console.log("DRY RUN: nothing was deleted. Run again with --execute to delete the rows above and the " + ids.length + " test tenants."); await p.end(); return; }
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    for (const s of steps) {
      const r = await client.query("delete " + s.where, [ids]);
      console.log("deleted " + String(r.rowCount).padStart(4) + "  " + s.name);
    }
    const r = await client.query("delete from tenants where id = any($1) and subdomain ~ $2", [ids, PATTERN]);
    console.log("deleted " + String(r.rowCount).padStart(4) + "  tenants");
    await client.query("COMMIT");
    console.log("DONE: committed.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.log("ROLLED BACK, nothing was deleted: " + e.message);
  } finally { client.release(); }
  const left = await p.query("select id, subdomain from tenants order by id");
  console.log("tenants remaining:", left.rows.map((x) => x.id + ":" + x.subdomain).join(", "));
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });