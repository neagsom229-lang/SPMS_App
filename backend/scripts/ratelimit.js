require("dotenv").config();
const crypto = require("crypto");
const BASE = "http://localhost:5000/api";
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + "  -> " + detail); }
}
async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, data: data };
}
(async () => {
  const sub = "rl-" + crypto.randomBytes(4).toString("hex");
  const pw = "Qa!" + crypto.randomBytes(8).toString("hex");
  const reg = await api("POST", "/auth/register-client", { businessName: sub, email: sub + "@test.com", password: pw, subdomain: sub });
  check("registration works", reg.status === 201, reg.status);
  let token = null;
  const okCodes = [];
  for (let i = 0; i < 15; i++) {
    const r = await api("POST", "/auth/login", { username: sub + "_admin", password: pw });
    okCodes.push(r.status);
    if (r.data && r.data.token) token = r.data.token;
  }
  check("15 successful logins in a row are never blocked", okCodes.every((c) => c === 200), okCodes.join(","));
  const meCodes = [];
  for (let i = 0; i < 40; i++) { const r = await api("GET", "/auth/me", null, token); meCodes.push(r.status); }
  check("40 token checks (/auth/me) are never blocked", meCodes.every((c) => c === 200), meCodes.join(","));
  const bad = [];
  for (let i = 0; i < 14; i++) { const r = await api("POST", "/auth/login", { username: sub + "_admin", password: "wrong-" + i }); bad.push(r.status); }
  check("the first wrong passwords get 401", bad.slice(0, 10).every((c) => c === 401), bad.join(","));
  check("repeated wrong passwords are then blocked with 429", bad.slice(10).some((c) => c === 429), bad.join(","));
  const locked = await api("POST", "/auth/login", { username: sub + "_admin", password: pw });
  console.log("INFO  correct password while the address is locked -> " + locked.status + " (a 429 here is the known trade-off of IP-based limits)");
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("SCRIPT ERROR:", e.message); process.exit(1); });