// backend/scripts/names-accept.js
//
// OWNER-ONLY. Copies backend/tests/expected-names.proposed.txt (written by
// npm run verify after every full jest run) over backend/tests/expected-names.txt,
// printing the diff it is about to apply. The owner then commits the baseline:
//   npm run names:accept && git add backend/tests/expected-names.txt
//
// The agent never runs this script and never writes expected-names.txt.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REL_BASE = 'backend/tests/expected-names.txt';
const REL_PROP = 'backend/tests/expected-names.proposed.txt';
const BASE = path.join(ROOT, REL_BASE);
const PROP = path.join(ROOT, REL_PROP);

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
}

function parse(text) {
  return splitLines(text).map(line => {
    const i = line.indexOf('\t');
    if (i === -1) return { file: '(unknown)', name: line.trim() };
    return { file: line.slice(0, i).trim(), name: line.slice(i + 1).trim() };
  });
}

function group(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.file)) m.set(r.file, []);
    m.get(r.file).push(r.name);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

if (!fs.existsSync(PROP)) {
  console.error(`FAIL: missing ${REL_PROP}`);
  console.error('Run `npm run verify` first; it writes the proposed baseline after the jest run.');
  process.exit(1);
}

const proposedText = fs.readFileSync(PROP, 'utf8');
const proposed = parse(proposedText);
if (proposed.length === 0) {
  console.error(`FAIL: ${REL_PROP} is empty; refusing to wipe the baseline.`);
  process.exit(1);
}

const currentText = fs.existsSync(BASE) ? fs.readFileSync(BASE, 'utf8') : '';
const current = parse(currentText);
const curKeys = new Set(current.map(r => `${r.file}\t${r.name}`));
const proKeys = new Set(proposed.map(r => `${r.file}\t${r.name}`));
const removed = current.filter(r => !proKeys.has(`${r.file}\t${r.name}`));
const added = proposed.filter(r => !curKeys.has(`${r.file}\t${r.name}`));

console.log(`current: ${current.length} names -> proposed: ${proposed.length} names`);
console.log('');
console.log('-- removed (will leave the baseline) --');
const remByFile = group(removed);
if (remByFile.length === 0) console.log('  (none)');
for (const [f, names] of remByFile) {
  console.log(`  ${f}`);
  names.sort().forEach(n => console.log(`    - ${n}`));
}
console.log('-- added (will enter the baseline) --');
const addByFile = group(added);
if (addByFile.length === 0) console.log('  (none)');
for (const [f, names] of addByFile) {
  console.log(`  ${f}`);
  names.sort().forEach(n => console.log(`    + ${n}`));
}
console.log('');

if (removed.length > 0) {
  console.log(`NOTE: this accepts ${removed.length} removed name(s). A test name only leaves`);
  console.log('the baseline when its test was deleted on purpose. Review the list above.');
}

fs.writeFileSync(BASE, proposedText);
console.log(`wrote ${REL_BASE} (${proposed.length} names).`);
console.log('Commit it yourself:');
console.log('  git add backend/tests/expected-names.txt && git commit -m "test: accept expected test names"');
