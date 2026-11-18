// backend/scripts/dev.js
//
// Root `npm run dev` orchestrator:
//   1. db:dev:up     — preflight (docker + port), start dev DB, wait for healthy
//   2. db:dev:migrate — create spms_dev if needed, baseline + real runner
//   3. db:dev:seed   — demo shop (guarded to local hosts only)
//   4. start the backend and the frontend dev server
//   5. print the URLs
//
// The database steps live in dev-db.js so `npm run db:dev:up|migrate|seed` work
// standalone. Every child gets SPMS_DB_MODE=dev and a loopback DATABASE_URL.
process.env.SPMS_DB_MODE = process.env.SPMS_DB_MODE || 'dev';

const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { DEV_DB_NAME, DEV_DB_PORT, devDatabaseUrl, assertDevDatabaseUrl, isLocal } = require('./_guard');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DEV_DB = path.join(__dirname, 'dev-db.js');
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

function runDb(command) {
  execFileSync(process.execPath, [DEV_DB, command], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
}

async function main() {
  const identity = assertDevDatabaseUrl(DEV_URL);
  if (!isLocal(DEV_URL)) {
    throw new Error(`refusing to start: dev database is not local (${identity.host})`);
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== DEV_URL && /supabase|neon|render|amazonaws/i.test(process.env.DATABASE_URL)) {
    console.log('ignoring a remote DATABASE_URL from the shell; dev uses the local dev container only');
  }

  console.log(`1/5 db:dev:up (preflight + ${DEV_DB_NAME} on 127.0.0.1:${DEV_DB_PORT})...`);
  runDb('up');

  console.log('2/5 db:dev:migrate...');
  runDb('migrate');

  console.log('3/5 db:dev:seed...');
  runDb('seed');

  if (process.argv.includes('--setup-only')) {
    console.log('setup-only: dev database, migrations and demo seed are ready; servers not started');
    return;
  }

  console.log('4/5 starting backend and frontend...');
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
