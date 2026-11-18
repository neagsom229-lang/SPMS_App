// backend/scripts/dev.js
//
// `npm run dev` from the repo root:
//   1. start the dev Postgres container (own port, named volume, 127.0.0.1)
//   2. create spms_dev if missing and run the real migration runner
//   3. seed the demo shop (credentials printed once)
//   4. start the backend and the frontend dev server
//   5. print the URLs
process.env.SPMS_DB_MODE = process.env.SPMS_DB_MODE || 'dev';

const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { Client } = require('pg');
const { DEV_DB_NAME, DEV_DB_PORT, databaseUrl, devDatabaseUrl, assertDevDatabaseUrl, isLocal } = require('./_guard');
const { BASELINE, migrationFilesFrom, readSql } = require('./test-db');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.dev.yml');
const BACKEND_PORT = Number(process.env.DEV_BACKEND_PORT || 5000);
const FRONTEND_PORT = Number(process.env.DEV_FRONTEND_PORT || 5173);

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

// Migrations 001-014 are patches on top of the shipped schema, exactly like
// production. A brand-new dev database therefore starts from database/baseline
// .sql (schema after 014) with the ledger marked 001-014; the real runner then
// applies 015+. An existing dev database is left untouched.
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
    // A previously failed bootstrap can leave a schema_migrations table behind
    // without the schema. baseline.sql creates the table unconditionally.
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

async function main() {
  const identity = assertDevDatabaseUrl(DEV_URL);
  if (!isLocal(DEV_URL)) {
    throw new Error(`refusing to start: dev database is not local (${identity.host})`);
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== DEV_URL && /supabase|neon|render|amazonaws/i.test(process.env.DATABASE_URL)) {
    console.log('ignoring a remote DATABASE_URL from the shell; dev uses the local dev container only');
  }

  console.log(`1/5 starting dev postgres (${COMPOSE_FILE})...`);
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], { cwd: ROOT, stdio: 'inherit' });

  console.log(`2/5 ensuring database ${DEV_DB_NAME} on 127.0.0.1:${DEV_DB_PORT}...`);
  await ensureDatabase();
  await bootstrapDevSchema();

  console.log('3/5 running migrations...');
  execFileSync(process.execPath, [path.join(__dirname, 'run_migration.js')], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: childEnv(),
  });

  console.log('4/5 seeding the demo shop...');
  execFileSync(process.execPath, [path.join(__dirname, 'seed-demo.js')], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: childEnv(),
  });

  if (process.argv.includes('--setup-only')) {
    console.log('setup-only: dev database, migrations and demo seed are ready; servers not started');
    return;
  }

  console.log('5/5 starting backend and frontend...');
  const backend = spawn(process.execPath, [path.join(BACKEND, 'src', 'app.js')], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: childEnv({
      NODE_ENV: 'development',
      PORT: String(BACKEND_PORT),
      JWT_SECRET: process.env.DEV_JWT_SECRET || 'dev-only-jwt-secret-change-me-0123456789',
      FRONTEND_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
      CORS_ORIGINS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT},http://127.0.0.1:4173`,
    }),
  });

  const frontend = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)], {
    cwd: FRONTEND,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: childEnv({ VITE_API_URL: `http://127.0.0.1:${BACKEND_PORT}/api` }),
  });

  const stop = signal => {
    for (const child of [backend, frontend]) {
      if (child && !child.killed) child.kill(signal);
    }
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  const onExit = code => {
    stop('SIGTERM');
    process.exit(code);
  };
  backend.on('exit', onExit);
  frontend.on('exit', onExit);

  console.log('');
  console.log('dev ready');
  console.log(`  frontend: http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`  backend:  http://127.0.0.1:${BACKEND_PORT}  (health: /health)`);
  console.log(`  database: ${DEV_DB_NAME} on 127.0.0.1:${DEV_DB_PORT} (container spms_dev_db)`);
  console.log('  stop with Ctrl+C');
}

main().catch(err => {
  console.error('dev start failed:', err.message);
  process.exit(1);
});
