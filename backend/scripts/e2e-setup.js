// backend/scripts/e2e-setup.js
//
// Everything the Playwright golden path needs before a browser opens:
//   1. the disposable test Postgres container (127.0.0.1:$TEST_DB_PORT, tmpfs)
//   2. spms_test rebuilt through the real migration runner
//   3. the demo shop seeded (admin/staff, 20 products, 10 sales)
//   4. the frontend built with VITE_API_URL pointing at the e2e backend
//
// The API base URL is baked into the bundle at build time, so this step must
// run before `vite preview`. Test mode is forced: the seed and the runner both
// refuse any database that is not 127.0.0.1:<test port>/…_test.
process.env.SPMS_DB_MODE = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = require('./_guard').testDatabaseUrl();
}

const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.test.yml');
const E2E_API = process.env.E2E_API_URL || 'http://127.0.0.1:5050/api';

// A CI job may already serve the test database (service container on the same
// port). Probe first so `docker compose up` does not fight it for the port.
function testDbReachable() {
  return new Promise(resolve => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    client.on('error', () => {});
    client
      .connect()
      .then(() => client.query('SELECT 1'))
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => client.end().catch(() => {}));
  });
}

async function setup({ build = true } = {}) {
  console.log('e2e setup: checking the test postgres container...');
  if (await testDbReachable()) {
    console.log('e2e setup: test database already reachable, skipping docker compose');
  } else {
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], { cwd: ROOT, stdio: 'inherit' });
  }

  console.log('e2e setup: rebuilding spms_test through the real runner...');
  const { buildTestDatabase } = require('./test-db');
  const built = await buildTestDatabase('spms_test');
  console.log(`e2e setup: ${built.ledger.total} migrations applied`);

  console.log('e2e setup: seeding the demo shop...');
  const { seed } = require('./seed-demo');
  await seed();

  if (build) {
    console.log(`e2e setup: building the frontend (VITE_API_URL=${E2E_API})...`);
    execFileSync('npm', ['run', 'build'], {
      cwd: FRONTEND,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, VITE_API_URL: E2E_API },
    });
  }
  console.log('e2e setup: ready');
}

if (require.main === module) {
  setup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('e2e setup failed:', err.message);
      process.exit(1);
    });
}

module.exports = { setup, E2E_API };
