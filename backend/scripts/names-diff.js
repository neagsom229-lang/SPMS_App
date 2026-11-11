// backend/scripts/names-diff.js
//
// Compares test names against the COMMITTED baseline, never the working tree.
// Reading the baseline out of git means only an owner commit can change it.
//
//   npm run names:diff                  working copy  vs  HEAD
//   npm run names:diff -- --from-run X  jest --json   vs  HEAD
//
// Never writes anything. Exit code 1 on any drop.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REL = 'backend/tests/expected-names.txt';
const WORKING = path.join(ROOT, REL);

function readCommitted() {
  try {
    const out = execFileSync('git', ['show', `HEAD:${REL}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { ok: true, text: out };
  } catch (e) {
    return { ok: false, text: '' };
  }
}

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
}

// A line is "<file>\t<full > test > name>". Older single-column files are
// tolerated: the file column is reported as "(unknown)".
function parse(text) {
  return splitLines(text).map(line => {
    const i = line.indexOf('\t');
    if (i === -1) return { file: '(unknown)', name: line.trim() };
    return { file: line.slice(0, i).trim(), name: line.slice(i + 1).trim() };
  });
}

function countByFile(rows) {
  const c = {};
  for (const r of rows) c[r.file] = (c[r.file] || 0) + 1;
  return c;
}

function namesFromJestData(data) {
  const rows = [];
  for (const suite of data.testResults) {
    const file = path.relative(ROOT, suite.name).replace(/\\/g, '/');
    for (const a of suite.assertionResults) {
      rows.push({ file, name: [...a.ancestorTitles, a.title].join(' > ') });
    }
  }
  return rows;
}

function namesFromJest(jsonPath) {
  return namesFromJestData(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
}

// Used by scripts/verify.js. Compares a parsed jest --json object against the
// COMMITTED baseline. Before the owner commits the baseline there is nothing
// to enforce, so a missing HEAD copy is a warning, not a failure.
function checkAgainstCommitted(jestData) {
  const committed = readCommitted();
  if (!committed.ok) {
    console.warn(`names-check: no committed baseline at ${REL}; skipping per-file floor check (commit it to enable).`);
    return { ok: true, skipped: true };
  }
  const expected = parse(committed.text);
  const actual = namesFromJestData(jestData);
  const cmp = compare(actual, expected);
  const ok = printReport('jest run vs HEAD', {
    committedCount: expected.length,
    actualCount: actual.length,
  }, cmp);
  return { ok, skipped: false, cmp };
}

function compare(actual, expected) {
  const actualNames = new Set(actual.map(r => r.name));
  const expectedNames = new Set(expected.map(r => r.name));

  const removed = [...expectedNames].filter(n => !actualNames.has(n)).sort();
  const added = [...actualNames].filter(n => !expectedNames.has(n)).sort();

  const aCount = countByFile(actual);
  const eCount = countByFile(expected);
  const files = [...new Set([...Object.keys(eCount), ...Object.keys(aCount)])].sort();
  const drops = files
    .filter(f => (aCount[f] || 0) < (eCount[f] || 0))
    .map(f => ({ file: f, committed: eCount[f] || 0, actual: aCount[f] || 0 }));

  return { removed, added, aCount, eCount, files, drops };
}

function printReport(label, rows, cmp) {
  console.log(`== ${label} ==`);
  console.log(`committed: ${rows.committedCount} names / actual: ${rows.actualCount} names`);
  console.log('');
  console.log('-- removed (in committed, missing now) --');
  cmp.removed.forEach(n => console.log('  - ' + n));
  if (cmp.removed.length === 0) console.log('  (none)');
  console.log('-- added (not in committed) --');
  cmp.added.forEach(n => console.log('  + ' + n));
  if (cmp.added.length === 0) console.log('  (none)');
  console.log('');
  console.log('-- per-file counts (committed -> actual) --');
  for (const f of cmp.files) {
    const c = cmp.eCount[f] || 0;
    const a = cmp.aCount[f] || 0;
    const flag = a < c ? '  DROP' : (a > c ? '  grow' : '');
    console.log(`  ${String(a).padStart(4)}  (${String(c).padStart(4)})  ${f}${flag}`);
  }
  console.log('');
  if (cmp.drops.length) {
    console.log('FAIL: file(s) below the committed count:');
    cmp.drops.forEach(d => console.log(`  ${d.file}: committed ${d.committed}, actual ${d.actual}`));
  } else {
    console.log('OK: no file below its committed count.');
  }
  return cmp.drops.length === 0 && cmp.removed.length === 0;
}

function main() {
  const argv = process.argv.slice(2);
  const fromRun = argv.indexOf('--from-run');
  const committed = readCommitted();

  if (!committed.ok) {
    console.error(`FAIL: no committed baseline at ${REL}`);
    console.error('Only an owner commit may create it. Until then this check cannot pass.');
    console.error(`  git add ${REL} && git commit -m "test: commit expected test names"`);
    process.exit(1);
  }

  const expected = parse(committed.text);

  let actual;
  if (fromRun !== -1) {
    const p = argv[fromRun + 1];
    if (!p) { console.error('--from-run needs a jest --json path'); process.exit(1); }
    actual = namesFromJest(p);
  } else {
    if (!fs.existsSync(WORKING)) { console.error(`FAIL: missing working copy ${WORKING}`); process.exit(1); }
    actual = parse(fs.readFileSync(WORKING, 'utf8'));
  }

  const cmp = compare(actual, expected);
  const ok = printReport(fromRun !== -1 ? `jest run vs HEAD` : `working copy vs HEAD`, {
    committedCount: expected.length,
    actualCount: actual.length,
  }, cmp);
  process.exit(ok ? 0 : 1);
}

module.exports = { readCommitted, parse, countByFile, namesFromJest, namesFromJestData, compare, checkAgainstCommitted };

if (require.main === module) main();
