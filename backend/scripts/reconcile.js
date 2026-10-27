require("dotenv").config();
const { Pool } = require("pg");
const base = "http://localhost:5000";
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const l = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: process.env.SEED_ADMIN_PASSWORD }) });
  const { token } = await l.json();
  const r = await fetch(base + "/api/dashboard/sales-summary?range=30d", { headers: { Authorization: "Bearer " + token } });
  const api = await r.json();
  console.log("API status", r.status, "| top-level keys:", Object.keys(api).join(", "));
  const st = ["Completed", "Paid", "Delivered"];
  const q = await p.query("select coalesce(sum(o.total),0)::float as revenue, count(*)::int as orders from tbl_orders o where o.tenant_id = $1 and o.status = ANY($2) and o.created_at >= now() - make_interval(days => 30)", [4, st]);
  const u = await p.query("select coalesce(sum(i.qty),0)::int as units, coalesce(sum((i.unit_price - i.buy_price) * i.qty),0)::float as profit from tbl_order_items i join tbl_orders o on o.or_id = i.order_id where o.tenant_id = $1 and o.status = ANY($2) and o.created_at >= now() - make_interval(days => 30)", [4, st]);
  console.table([
    { metric: "net_revenue", api: api.net_revenue, db: q.rows[0].revenue },
    { metric: "total_orders", api: api.total_orders, db: q.rows[0].orders },
    { metric: "units_sold", api: api.units_sold, db: u.rows[0].units },
    { metric: "gross_profit", api: api.gross_profit, db: u.rows[0].profit }
  ]);
  console.log("profit_margin:", api.profit_margin);
  console.log("previous:", JSON.stringify(api.previous || null).slice(0, 220));
  console.log("timeseries points:", (api.timeseries || []).length);
  console.log("by_category:", JSON.stringify(api.by_category || null).slice(0, 200));
  console.log("by_source:", JSON.stringify(api.by_source || null).slice(0, 200));
  console.log("refunds:", JSON.stringify(api.refunds || null), "| open_online_orders:", api.open_online_orders);
  await p.end();
})().catch(e => { console.log("FAILED:", e.message); process.exit(1); });
