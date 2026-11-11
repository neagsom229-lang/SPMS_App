// backend/scripts/verify-full.js
//
// Owner/nightly gate: verify, mutation (run-mutants.ps1), one Playwright
// golden path, then the whole jest suite three times. Exits 1 on any failure.
const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const failures = [];

// spawnSync with shell:true joins argv with spaces and does not quote them, so
// a project path containing a space (e.g. "...\from Github\...") is split
// apart. Keep shell off for node/powershell; only npx needs a shell on Windows.
function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  const ok = res.status === 0;
  if (!ok) failures.push(`${label} (exit ${res.status})`);
  return ok;
}

run('1/4 verify', process.execPath, [path.join(__dirname, 'verify.js')], { cwd: ROOT });

// Windows ships Windows PowerShell; Linux/macOS runners have pwsh.
const POWERSHELL = process.platform === 'win32' ? 'powershell' : 'pwsh';
run(
  '2/4 mutation (run-mutants.ps1)',
  POWERSHELL,
  ['-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'run-mutants.ps1')],
  { cwd: ROOT }
);

// Run Playwright's CLI through node: `npx` is a .cmd shim on Windows, which
// spawnSync cannot execute without a shell (and a shell splits paths on spaces).
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
run('3/4 playwright golden path', process.execPath, [PLAYWRIGHT_CLI, 'test'], { cwd: ROOT });

const jestBin = path.join(BACKEND, 'node_modules', 'jest', 'bin', 'jest.js');
for (let i = 1; i <= 3; i += 1) {
  run(`4/4 jest suite run ${i}/3`, process.execPath, [jestBin, '--runInBand'], { cwd: BACKEND });
}

if (failures.length) {
  console.error(`\n❌ VERIFY:FULL FAILED (${failures.length} step(s))`);
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('\n✅ VERIFY:FULL PASSED');
