require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.table((await p.query("select id, name, subdomain from tenants order by id")).rows);
  await p.end();
})().catch((e) => { console.log("FAILED:", e.message); process.exit(1); });
