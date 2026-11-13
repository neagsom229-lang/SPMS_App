// backend/scripts/verify.js
//
// The one screen the owner runs before a commit:
//   1. local test Postgres up (tmpfs container, 127.0.0.1)
//   2. jest --runInBand (globalSetup builds the DB through the real runner)
//   3. test-name gate against HEAD, per file
//   4. frontend production build, with every chunk size printed
//   5. npm audit --omit=dev --audit-level=high
//   6. secret scan (gitleaks git history; fails if gitleaks is not installed)
// Any failure exits 1.
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const { TEST_DB_PORT, testDatabaseUrl } = require('./_guard.js');

const STARTED = Date.now();
const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.test.yml');

const failures = [];
const fail = message => {
  failures.push(message);
  console.error(`❌ ${message}`);
};
const step = label => console.log(`\n=== ${label} ===`);

function seconds() {
  return ((Date.now() - STARTED) / 1000).toFixed(1);
}

function run(name, fn) {
  try {
    return fn();
  } catch (e) {
    const out = (e.stdout || '').toString().trim();
    if (out) console.error(out.split(/\r?\n/).slice(-15).join('\n'));
    fail(`${name}: ${e.message.split(/\r?\n/)[0]}`);
    return null;
  }
}

console.log('=== VERIFY PIPELINE STARTING ===');

// 1. test database -----------------------------------------------------------
step('1/6 test database');
// A CI job may already provide the test database (service container). Probe it
// first so verify does not fight an existing server for the port; otherwise
// bring up the disposable local container.
function dbReachable() {
  return new Promise(resolve => {
    const client = new Client({ connectionString: testDatabaseUrl(), connectionTimeoutMillis: 2000 });
    client
      .connect()
      .then(() => client.query('SELECT 1'))
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => client.end().catch(() => {}));
  });
}

async function ensureDatabase() {
  if (await dbReachable()) {
    console.log(`  test database already reachable at ${TEST_DB_PORT}, skipping docker compose`);
    return;
  }
  run('docker compose up', () => {
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], { cwd: ROOT, stdio: 'inherit' });
  });
}

async function main() {
await ensureDatabase();

// 2. jest --------------------------------------------------------------------
step('2/6 jest --runInBand');
const outFile = path.join(os.tmpdir(), `spms-verify-${process.pid}.json`);
let jestData = null;
run('jest', () => {
  execFileSync(
    process.execPath,
    [path.join(BACKEND, 'node_modules', 'jest', 'bin', 'jest.js'), '--config', path.join(BACKEND, 'jest.config.js'), '--runInBand', '--json', `--outputFile=${outFile}`],
    { cwd: BACKEND, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DATABASE_URL: testDatabaseUrl() } }
  );
});
if (fs.existsSync(outFile)) {
  jestData = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  fs.unlinkSync(outFile);
}
if (!jestData) {
  fail('jest produced no JSON output');
} else {
  console.log(`Test Suites: ${jestData.numPassedTestSuites} passed, ${jestData.numTotalTestSuites} total`);
  console.log(`Tests:       ${jestData.numPassedTests} passed, ${jestData.numTotalTests} total`);
  if (jestData.numFailedTests > 0 || jestData.numRuntimeErrorTestSuites > 0) {
    fail(`jest failures: ${jestData.numFailedTests} tests, ${jestData.numRuntimeErrorTestSuites} suites`);
  }
}

// 3. test-name gate vs HEAD, per file ---------------------------------------
step('3/6 test-name gate (HEAD)');
if (jestData) {
  const namesCheck = require('./names-diff').checkAgainstCommitted(jestData);
  if (!namesCheck.ok) {
    fail('test-name gate: a file is below its committed HEAD count');
  }
}

// 4. frontend build ----------------------------------------------------------
step('4/6 frontend build');
const built = run('frontend build', () => {
  execFileSync('npm', ['run', 'build'], { cwd: FRONTEND, stdio: 'inherit', shell: process.platform === 'win32' });
  return true;
});
if (built) {
  const assetsDir = path.join(FRONTEND, 'dist', 'assets');
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') || f.endsWith('.css'));
  const rows = files
    .map(f => ({ f, kb: fs.statSync(path.join(assetsDir, f)).size / 1024 }))
    .sort((a, b) => b.kb - a.kb);
  console.log('chunk sizes (kB):');
  for (const row of rows) console.log(`  ${row.kb.toFixed(1).padStart(8)}  ${row.f}`);
  const main = rows.find(r => /^index-.*\.js$/.test(r.f));
  if (main) console.log(`main JS chunk: ${main.f} ${main.kb.toFixed(1)} kB`);
}

// 5. npm audit ---------------------------------------------------------------
step('5/6 npm audit (omit=dev, high)');
for (const dir of [ROOT, BACKEND, FRONTEND]) {
  const label = path.relative(ROOT, dir) || '.';
  run(`npm audit (${label})`, () => {
    execFileSync('npm', ['audit', '--omit=dev', '--audit-level=high'], {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    console.log(`  ${label}: no high/critical advisories in production dependencies`);
  });
}

// 6. secret scan -------------------------------------------------------------
step('6/6 secret scan');
const PATTERNS = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['aws access key id', /AKIA[0-9A-Z]{16}/],
  ['github token', /\bgh[pousr]_[0-9A-Za-z]{36,}\b/],
  ['slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['stripe live secret', /\bsk_live_[0-9A-Za-z]{20,}\b/],
  ['supabase service key', /service_role[^\n]{0,40}eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['jwt literal', /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
];

const REMOTE_DB_URL = /postgres(?:ql)?:\/\/([^\s:@/]+):([^\s@/]+)@([^\s/?#]+)/g;
const PLACEHOLDER_PASSWORD = /^(postgres|password|pass|p|changeme|change-me|your[-_]?password|example|secret|test|\$\{.+\}|<.+>)$/i;

// A real remote database URL with a real password, ignoring the placeholders
// used in .env.example, compose files and guard tests.
function remoteDbPasswordHits(text) {
  const hits = [];
  for (const m of text.matchAll(REMOTE_DB_URL)) {
    const password = m[2];
    const host = m[3];
    if (/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) continue;
    if (/\$\{/.test(password) || /\$\{/.test(host)) continue;
    if (PLACEHOLDER_PASSWORD.test(password)) continue;
    if (password.length < 8) continue;
    hits.push(`remote db url with password at ${host}`);
  }
  return hits;
}

function scanSecretsWithRegex() {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(f => !/(^|\/)(node_modules|dist|\.git)\//.test(f))
    .filter(f => !/^package-lock\.json$/.test(f))
    .filter(f => !/\.(png|jpg|jpeg|gif|ico|webp|woff2?|ttf|eot|pdf|xlsx|accdb|db)$/i.test(f))
    .filter(f => fs.existsSync(path.join(ROOT, f)));

  const hits = [];
  for (const rel of files) {
    if (/\.env/.test(path.basename(rel)) && path.basename(rel) !== '.env.example') continue;
    let text;
    try {
      text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch (e) {
      continue;
    }
    for (const [label, re] of PATTERNS) {
      const m = text.match(re);
      if (m) hits.push(`${rel}: ${label}`);
    }
    if (path.basename(rel) !== '.env.example') {
      for (const hit of remoteDbPasswordHits(text)) hits.push(`${rel}: ${hit}`);
    }
  }
  return hits;
}

let gitleaksVersion = null;
try {
  gitleaksVersion = execFileSync('gitleaks', ['version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch (e) {
  gitleaksVersion = null;
}
if (gitleaksVersion) {
  console.log(`scanner: gitleaks ${gitleaksVersion} (git history, --redact)`);
  run('gitleaks', () => {
    execFileSync('gitleaks', ['git', '--no-banner', '--redact', '--exit-code', '1', '--config', '.gitleaks.toml'], { cwd: ROOT, stdio: 'inherit' });
  });
} else {
  console.log('scanner: gitleaks not installed (git history NOT scanned)');
  const hits = scanSecretsWithRegex();
  if (hits.length) {
    hits.forEach(h => console.error(`  ${h}`));
    fail(`secret scan found ${hits.length} candidate(s)`);
  } else {
    console.log('  no secret patterns found in tracked files');
  }
  fail('secret scan: install gitleaks so git history is scanned (winget install gitleaks)');
}

// result ---------------------------------------------------------------------
if (failures.length) {
  console.error(`\n❌ VERIFY FAILED (${seconds()}s): ${failures.length} check(s)`);
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`\n✅ ALL VERIFICATION CHECKS PASSED (${seconds()}s)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
