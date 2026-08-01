#!/usr/bin/env node
/**
 * fix-api-client.mjs
 *
 * Run this once from your frontend project root:
 *   node fix-api-client.mjs
 *
 * What it does, per .jsx/.js file under src/ (excluding src/api/client.js itself):
 *   1. Detects a local axios instance block, e.g.:
 *        const API_BASE = import.meta.env?.VITE_API_URL || '...';
 *        const api = axios.create({ ... });
 *        api.interceptors.request.use(...);
 *        api.interceptors.response.use(...);
 *   2. Removes that whole block.
 *   3. Removes `import axios from 'axios';` if axios is no longer used directly.
 *   4. Inserts `import apiClient from '<relative path>/api/client';` after the last
 *      top-level import.
 *   5. Renames every `api.get(`, `api.post(`, `api.put(`, `api.delete(`,
 *      `api.patch(` call to use `apiClient` instead.
 *
 * It PRINTS a diff-like summary per file and asks nothing — review with git diff
 * afterwards and revert any file you don't want changed.
 *
 * Safe by design: if a file doesn't match the expected local-axios pattern,
 * it is left untouched and reported as "skipped".
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = process.argv[2] || 'src';
const CLIENT_FILE_HINT = 'api/client'; // adjust if your shared client lives elsewhere

const AXIOS_BLOCK_RE =
  /const\s+API_BASE\s*=[^;]+;\s*\n(?:console\.log\([^)]*\);\s*\n)?\s*\n?const\s+api\s*=\s*axios\.create\(\{[\s\S]*?\}\);\s*\n(?:\s*\n?api\.interceptors\.(?:request|response)\.use\(\s*[\s\S]*?\n\);\s*\n?){0,2}/;

function findFiles(dir, exts = ['.jsx', '.js'], acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      findFiles(full, exts, acc);
    } else if (exts.includes(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

function relativeImportPath(fromFile) {
  const fromDir = path.dirname(fromFile);
  const target = path.join(SRC_DIR, 'api', 'client');
  let rel = path.relative(fromDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function fixFile(file) {
  const original = fs.readFileSync(file, 'utf8');

  // Skip the shared client file itself.
  if (file.replace(/\\/g, '/').includes(`${CLIENT_FILE_HINT}.js`)) {
    return { file, status: 'skipped (is the shared client itself)' };
  }

  if (!AXIOS_BLOCK_RE.test(original)) {
    return { file, status: 'skipped (no local axios block found)' };
  }

  let content = original.replace(AXIOS_BLOCK_RE, '');

  // Remove now-unused `import axios from 'axios';` if axios isn't referenced elsewhere.
  const usesAxiosElsewhere = /\baxios\./.test(content);
  if (!usesAxiosElsewhere) {
    content = content.replace(/^\s*import\s+axios\s+from\s+['"]axios['"];\s*\n/m, '');
  }

  // Rename api.<method>( calls to apiClient.<method>(
  content = content.replace(
    /\bapi\.(get|post|put|delete|patch)\(/g,
    'apiClient.$1('
  );

  // Insert the apiClient import after the last top-level import line.
  const importRegex = /^import .+;\s*$/gm;
  let lastImportEnd = 0;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    lastImportEnd = m.index + m[0].length;
  }
  const importLine = `\nimport apiClient from '${relativeImportPath(file)}';`;
  content = content.slice(0, lastImportEnd) + importLine + content.slice(lastImportEnd);

  // Collapse 3+ blank lines left behind by the removed block into 1.
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(file, content, 'utf8');
  return { file, status: 'fixed ✅' };
}

const files = findFiles(SRC_DIR);
const results = files.map(fixFile);

console.log('\n=== fix-api-client.mjs summary ===\n');
for (const r of results) {
  console.log(`${r.status.padEnd(38)} ${r.file}`);
}
console.log(`\nDone. ${results.filter(r => r.status.startsWith('fixed')).length} file(s) fixed, ` +
  `${results.filter(r => r.status.startsWith('skipped')).length} skipped.\n` +
  `Review with: git diff\n`);
