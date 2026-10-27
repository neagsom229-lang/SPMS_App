require("dotenv").config();
const bcrypt = require("bcryptjs"); const { Pool } = require("pg");
(async () => {
  if (!process.env.SEED_ADMIN_PASSWORD) { console.log("SEED_ADMIN_PASSWORD is empty - set it in .env first"); return; }
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const h = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10);
  const r = await p.query("update tbl_users set password=$1 where username=$2 and tenant_id=(select id from tenants where subdomain=$3)", [h, "admin", "demo"]);
  console.log("rows updated:", r.rowCount);
  await p.end();
})().catch(e => { console.log("FAILED:", e.message); process.exit(1); });
