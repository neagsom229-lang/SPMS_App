const fs = require("fs");
const fix = process.argv.includes("--fix");
const files = process.argv.slice(2).filter((a) => a !== "--fix");
let lucide = {};
try { lucide = require("lucide-react"); } catch (e) { console.log("(lucide-react not loadable: " + e.message + ")"); }
let total = 0;
for (const f of files) {
  let src = fs.readFileSync(f, "utf8");
  const declared = new Set(["React", "Fragment"]);
  for (const m of src.matchAll(/import\s+([^;\x22\x27]*?)\s+from\s+[\x22\x27][^\x22\x27]+[\x22\x27]/g)) {
    for (const part of m[1].replace(/[{}*]/g, ",").split(",")) {
      const t = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(t)) declared.add(t);
    }
  }
  for (const m of src.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  const used = new Map();
  src.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(/<([A-Z][A-Za-z0-9_$]*)/g)) if (!used.has(m[1])) used.set(m[1], i + 1);
    for (const m of line.matchAll(/=\{\s*([A-Z][A-Za-z0-9_$]*)\s*\}/g)) if (!used.has(m[1])) used.set(m[1], i + 1);
  });
  const missing = [...used.entries()].filter(([n]) => !declared.has(n));
  if (!missing.length) { console.log("ok       " + f); continue; }
  total += missing.length;
  for (const [n, ln] of missing) console.log("MISSING  " + f + ":" + ln + "  " + n + (lucide[n] ? "  (lucide-react icon)" : "  (not a lucide icon - check by hand)"));
  const icons = missing.map((x) => x[0]).filter((n) => lucide[n]);
  if (fix && icons.length) {
    const re = /import\s*\{([^}]*)\}\s*from\s*[\x22\x27]lucide-react[\x22\x27]/;
    const m = src.match(re);
    if (m) {
      const merged = [...new Set([...m[1].split(",").map((s) => s.trim()).filter(Boolean), ...icons])];
      src = src.replace(re, () => "import { " + merged.join(", ") + " } from \"lucide-react\"");
    } else {
      src = "import { " + icons.join(", ") + " } from \"lucide-react\";\n" + src;
    }
    fs.writeFileSync(f, src, "utf8");
    console.log("FIXED    " + f + " <- added " + icons.join(", "));
  }
}
console.log(total ? total + " unresolved name(s)" : "all JSX names resolve");
