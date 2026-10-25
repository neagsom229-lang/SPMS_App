require("dotenv").config();
const base = "http://localhost:5000";
(async () => {
  const l = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: process.env.SEED_ADMIN_PASSWORD }) });
  const { token } = await l.json();
  for (const range of ["30d", "today"]) {
    const r = await fetch(base + "/api/dashboard/sales-summary?range=" + range, { headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    console.log("=== range", range, "status", r.status);
    console.log("refunds:", JSON.stringify(j.refunds));
    console.log("change_pct:", JSON.stringify(j.change_pct));
    for (const k of ["timeseries", "by_category", "by_payment_method", "by_source", "top_products", "alerts"]) console.log(k + " [" + (j[k] || []).length + "] sample:", JSON.stringify((j[k] || [])[0]));
  }
})().catch(e => { console.log("FAILED:", e.message); process.exit(1); });
