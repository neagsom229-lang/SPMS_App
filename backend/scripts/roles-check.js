require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.table((await p.query("select role, role_name, count(*)::int as n from tbl_users group by 1, 2 order by 1")).rows);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
