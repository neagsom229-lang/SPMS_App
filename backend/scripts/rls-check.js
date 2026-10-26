require("dotenv").config();
const { Pool } = require("pg");
const fix = process.argv.includes("--fix");
(async () => {
  const p = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const me = await p.query("select current_user as u, (select rolbypassrls from pg_roles where rolname = current_user) as bypass");
  console.log("connected as role:", me.rows[0].u, "| bypasses RLS:", me.rows[0].bypass);
  const t = await p.query("select c.relname as table_name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = $1 and c.relkind = $2 order by 1", ["public", "r"]);
  const off = t.rows.filter((r) => !r.rls).map((r) => r.table_name);
  console.log(off.length ? "RLS OFF on: " + off.join(", ") : "RLS is ON for every public table");
  if (fix && off.length) {
    if (!me.rows[0].bypass) { console.log("Refusing to fix: this role does not bypass RLS, the backend could lose access."); }
    else { for (const n of off) { await p.query("ALTER TABLE public.\"" + n + "\" ENABLE ROW LEVEL SECURITY"); console.log("enabled RLS on", n); } }
  }
  const pol = await p.query("select tablename, policyname from pg_policies where schemaname = $1", ["public"]);
  console.log("policies:", pol.rows.length ? JSON.stringify(pol.rows) : "none (anon is denied everything)");
  for (const tb of ["tbl_users", "tbl_products", "tbl_orders", "tbl_customers"]) {
    const c = await p.connect();
    try { await c.query("BEGIN"); await c.query("SET LOCAL ROLE anon"); const r = await c.query("select count(*)::int as n from public." + tb); console.log("anon can read " + tb + ": " + r.rows[0].n + " row(s)"); }
    catch (e) { console.log("anon read of " + tb + ": blocked (" + e.message + ")"); }
    finally { await c.query("ROLLBACK").catch(() => {}); c.release(); }
  }
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
