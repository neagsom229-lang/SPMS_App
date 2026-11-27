// backend/scripts/dev-db.js
//
// Guarded local-dev database commands.
//
//   node dev-db.js preflight   mode-aware checks, fail fast with Windows hints
//   node dev-db.js up          local: verify native PG; docker: start container
//   node dev-db.js migrate     baseline on an empty DB, then the real runner
//   node dev-db.js seed        seed the demo shop (local hosts only)
//
// DEV_DB_MODE=local talks to the native PostgreSQL install from backend/.env
// and never starts Docker. The default (docker) is kept for checkouts without
// that file. Nothing in this file prints a credential.
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { loadDevEnv } = require('./dev-env');

const MODE = loadDevEnv().mode;
const {
  DB_HOST,
  DEV_DB_NAME,
  DEV_DB_PORT,
  DEV_DB_CONTAINER,
  databaseUrl,
  devDatabaseUrl,
  assertDevDatabaseUrl,
  isLocal,
  modeConfig,
  preflightDevDocker,
} = require('./_guard');
const { BASELINE, migrationFilesFrom, readSql } = require('./test-db');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.dev.yml');
const DEV_URL = devDatabaseUrl();
const CONFIG = modeConfig(MODE === 'local' ? 'local' : 'dev');

function childEnv(extra = {}) {
  const env = {
    ...process.env,
    SPMS_DB_MODE: MODE === 'local' ? 'local' : 'dev',
    DATABASE_URL: DEV_URL,
    ...extra,
  };
  // The dev loop must never be able to reach a remote database.
  delete env.ALLOW_REMOTE_DB;
  delete env.RENDER;
  return env;
}

function assertLocal() {
  const identity = assertDevDatabaseUrl(DEV_URL);
  if (!isLocal(DEV_URL)) {
    throw new Error(`refusing to touch a non-local database (${identity.host}); dev requires ${DB_HOST}:${DEV_DB_PORT}/${DEV_DB_NAME}`);
  }
}

// Windows-friendly explanation for the failures people actually hit.
function explainConnectError(err) {
  const target = `${DB_HOST}:${DEV_DB_PORT}/${DEV_DB_NAME}`;
  switch (err.code) {
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
      return `PostgreSQL is not accepting connections at ${target}.\n` +
        '  Start the service: services.msc -> postgresql-x64-18 (or: net start postgresql-x64-18)\n' +
        '  Then retry: npm run dev';
    case '28P01':
    case '28000':
      return `PostgreSQL rejected the credentials for this role at ${target}.\n` +
        '  Update DATABASE_URL in backend/.env (the password is never printed).\n' +
        '  If the role is new, run database/local/001_app_role.sql once as postgres.';
    case '3D000':
      return `Database "${DEV_DB_NAME}" does not exist at ${DB_HOST}:${DEV_DB_PORT}.\n` +
        '  Create it once as postgres: database/local/001_app_role.sql';
    case '42501':
      return `This role cannot connect to "${DEV_DB_NAME}".\n` +
        '  Re-run database/local/001_app_role.sql as postgres to grant CONNECT.';
    default:
      return `${err.message}\n  Target: ${target} (no credential shown)`;
  }
}

async function reachable() {
  const client = new Client({ connectionString: DEV_URL, connectionTimeoutMillis: 3000 });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function preflightLocal() {
  const client = new Client({ connectionString: DEV_URL, connectionTimeoutMillis: 3000 });
  client.on('error', () => {});
  try {
    await client.connect();
    const res = await client.query('SELECT current_database() AS db, version() AS version');
    const version = String(res.rows[0].version).split(',')[0];
    console.log(`preflight ok: ${res.rows[0].db} on ${DB_HOST}:${DEV_DB_PORT} (${version})`);
  } catch (e) {
    console.error(`❌ ${explainConnectError(e)}`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

async function preflight() {
  assertLocal();
  if (MODE === 'local') {
    // No Docker: the native service and the database must already exist.
    await preflightLocal();
    return;
  }
  if (await reachable()) {
    console.log('preflight ok: dev DB already healthy (port owned by its container)');
    return;
  }
  try {
    await preflightDevDocker(DEV_DB_PORT);
    console.log('preflight ok: docker running and port available');
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}

async function up() {
  if (MODE === 'local') {
    await preflightLocal();
    return;
  }
  if (await reachable()) {
    console.log(`db:dev:up: ${DEV_DB_NAME} already healthy on ${DB_HOST}:${DEV_DB_PORT}`);
    return;
  }
  console.log(`db:dev:up: preflight (docker + port ${DEV_DB_PORT})...`);
  try {
    await preflightDevDocker(DEV_DB_PORT);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  console.log(`db:dev:up: starting ${DEV_DB_CONTAINER} via ${COMPOSE_FILE}...`);
  try {
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], {
      cwd: ROOT, stdio: 'inherit',
    });
  } catch (e) {
    console.error(`❌ docker compose up failed: ${(e.message || '').split(/\r?\n/)[0]}`);
    console.error('   Start Docker Desktop and retry.');
    process.exit(1);
  }
  if (!(await reachable())) {
    console.error(`❌ ${DEV_DB_NAME} is not accepting connections on ${DB_HOST}:${DEV_DB_PORT}`);
    process.exit(1);
  }
  console.log(`db:dev:up: healthy on ${DB_HOST}:${DEV_DB_PORT}`);
}

// Docker only. The native local role deliberately has no CREATEDB privilege.
async function ensureDatabase() {
  const client = new Client({ connectionString: databaseUrl('dev', 'postgres') });
  client.on('error', () => {});
  await client.connect();
  try {
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DEV_DB_NAME]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${DEV_DB_NAME}`);
      console.log(`created database ${DEV_DB_NAME}`);
    }
  } finally {
    await client.end();
  }
}

// Baseline 001-014 is applied only to a brand-new database, exactly like prod.
async function bootstrapDevSchema() {
  const client = new Client({ connectionString: DEV_URL });
  client.on('error', () => {});
  await client.connect();
  try {
    const exists = await client.query(`SELECT to_regclass('public.tenants') AS t`);
    if (exists.rows[0].t) {
      console.log('dev schema already present; runner will check for pending migrations');
      return;
    }
    console.log('loading database/baseline.sql (schema after 014)...');
    await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
    await client.query(readSql(BASELINE));
    await client.query('SET search_path TO public');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    for (const file of migrationFilesFrom(1, 14)) {
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
    }
    console.log('ledger marked 001-014');
  } finally {
    await client.end();
  }
}

async function migrate() {
  if (MODE === 'local') {
    await preflightLocal();
  } else {
    await up();
    await ensureDatabase();
  }
  await bootstrapDevSchema();
  execFileSync(process.execPath, [path.join(BACKEND, 'scripts', 'run_migration.js')], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
  console.log('db:dev:migrate: done');
}

async function seed() {
  assertLocal();
  if (MODE === 'local') {
    await preflightLocal();
  } else {
    await up();
  }
  execFileSync(process.execPath, [path.join(BACKEND, 'scripts', 'seed-demo.js')], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
  console.log('db:dev:seed: done');
}

async function main() {
  assertLocal();
  const cmd = process.argv[2];
  if (cmd === 'preflight') {
    await preflight();
  } else if (cmd === 'up') {
    await up();
  } else if (cmd === 'migrate') {
    await migrate();
  } else if (cmd === 'seed') {
    await seed();
  } else {
    console.error('usage: node dev-db.js <preflight|up|migrate|seed>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('dev-db command failed:', err.message);
  if (MODE === 'local' && /ECONNREFUSED|28P01|3D000|42501/.test(err.message)) {
    console.error('Run: npm run db:dev:preflight');
  }
  process.exit(1);
});
