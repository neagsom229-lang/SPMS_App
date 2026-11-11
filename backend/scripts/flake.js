// backend/scripts/flake.js
// Runs the full jest suite N times (default 10) and reports failures per run.
const { execFileSync } = require('child_process');
const path = require('path');

const runs = Number(process.argv[2] || 10);
if (!Number.isInteger(runs) || runs < 1) {
  console.error('usage: npm run flake -- <runs>');
  process.exit(1);
}

const backend = path.join(__dirname, '..');
const jestBin = require.resolve('jest/bin/jest');

function failureSummary(output) {
  const lines = String(output || '').split(/\r?\n/);
  const keep = lines.filter(line => /^(FAIL|Tests:|Test Suites:|●)/.test(line.trim()));
  return keep.slice(-20).join('\n');
}

let failed = 0;

for (let run = 1; run <= runs; run++) {
  const started = Date.now();
  try {
    execFileSync(process.execPath, [jestBin], {
      cwd: backend,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env },
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`run ${run}/${runs}: PASS (${seconds}s)`);
  } catch (err) {
    failed++;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`run ${run}/${runs}: FAIL (${seconds}s)`);
    const summary = failureSummary(`${err.stdout || ''}\n${err.stderr || ''}`);
    if (summary) console.log(summary);
  }
}

console.log(`flake: ${runs - failed}/${runs} runs passed`);
process.exit(failed === 0 ? 0 : 1);
