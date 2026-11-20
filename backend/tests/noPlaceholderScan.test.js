// backend/tests/noPlaceholderScan.test.js
//
// The purchase/offline-fallback and "Unknown/N/A" placeholder fixes must not
// regress. This scan runs against the frontend source tree that ships in the
// app (not generated output) and fails if any banned token reappears.
const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', '..', 'frontend', 'src');

const BANNED_PATTERNS = [
  { label: 'local purchase fallback writer', re: /persistOrderLocally/ },
  { label: 'fallback customer/product data', re: /getFallback(Customers|Products)/ },
  { label: 'silent local-save purchase warning', re: /Purchase API failed, saving locally/ },
  { label: 'fake local-save success message', re: /Order saved locally/ },
  { label: 'offline order cache badge', re: /orders-list-offline-badge/ },
  { label: 'local cache clear action', re: /Clear local cache/ },
  { label: 'UI fallback renders "Unknown"', re: />\s*Unknown\s*</ },
  { label: 'string fallback to "Unknown"', re: /\|\|\s*['"]Unknown['"]/ },
  { label: 'string fallback to "N/A"', re: /\|\|\s*['"]N\/A['"]/ },
  { label: 'string fallback to "undefined"', re: /\|\|\s*['"]undefined['"]/ },
  { label: 'demo placeholder name "John Doe"', re: /John Doe/ },
  { label: 'demo placeholder name "Jane Doe"', re: /Jane Doe/ },
  { label: 'lorem placeholder copy', re: /\blorem\b/i },
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Frontend no-placeholder scan', () => {
  test('Banned offline-fallback and placeholder tokens are absent from frontend source', () => {
    const files = walk(FRONTEND_SRC);
    expect(files.length).toBeGreaterThan(0);

    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/');
      for (const { label, re } of BANNED_PATTERNS) {
        if (re.test(text)) hits.push(`${rel}: ${label}`);
      }
    }

    expect(hits).toEqual([]);
  });
});
