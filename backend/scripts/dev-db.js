// backend/scripts/dev-db.js
//
// Guarded local-dev database commands. Every command refuses any database that
// is not the loopback *_dev container:
//   node dev-db.js preflight   docker + port checks, fail fast with Windows hints
//   node dev-db.js up          start the dev container and wait until healthy
//   node dev-db.js migrate     create spms_dev if needed, baseline + real runner
//   node dev-db.js seed        seed the demo shop (local hosts only)
//
// No credential is ever printed. The dev URL is derived from _guard.js, so a
// remote DATABASE_URL / DIRECT_URL in the shell can never reach these commands.
process.env.SPMS_DB_MODE = 'dev';

const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const {
  DB_HOST,
  DEV_DB_NAME,
  DEV_DB_PORT,
  DEV_DB_CONTAINER,
  databaseUrl,
  devDatabaseUrl,
  assertDevDatabaseUrl,
  isLocal,
  preflightDevDocker,
} = require('./_guard');
const { BASELINE, migrationFilesFrom, readSql } = require('./test-db');

const BACKEND = __dirname;
const ROOT = path.join(BACKEND, '..');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.dev.yml');
const DEV_URL = devDatabaseUrl();

function childEnv(extra = {}) {
  const env = {
    ...process.env,
    SPMS_DB_MODE: 'dev',
    DATABASE_URL: DEV_URL,
    ...extra,
  };
  // The dev loop must never be able to reach a remote database.
  delete env.DIRECT_URL;
  delete env.ALLOW_REMOTE_DB;
  delete env.RENDER;
  return env;
}

function assertLocal() {
  const identity = assertDevDatabaseUrl(DEV_URL);
  if (!isLocal(DEV_URL)) {
    throw new Error(`refusing to touch a non-local database (${identity.host}); dev requires ${DB_HOST}:${DEV_DB_PORT}/${DEV_DB_NAME}`);
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== DEV_URL &&
      /supabase|neon|render|amazonaws/i.test(process.env.DATABASE_URL)) {
    console.log('ignoring a remote DATABASE_URL from the shell; dev uses the local dev container only');
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

async function up() {
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
  console.log(`db:dev:up: healthy on ${DB_HOST}:${DEV_DB_PORT} (volume spms_dev_pgdata reused)`);
}

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
  await up();
  await ensureDatabase();
  await bootstrapDevSchema();
  execFileSync(process.execPath, [path.join(BACKEND, 'run_migration.js')], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
  console.log('db:dev:migrate: done');
}

async function seed() {
  assertLocal();
  await up();
  execFileSync(process.execPath, [path.join(BACKEND, 'seed-demo.js')], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
  console.log('db:dev:seed: done');
}

async function main() {
  assertLocal();
  const cmd = process.argv[2];
  if (cmd === 'preflight') {
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
  process.exit(1);
});
