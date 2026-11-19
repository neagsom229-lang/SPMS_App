// backend/scripts/dev.js
//
// Root `npm run dev` orchestrator:
//   1. preflight      — native PostgreSQL reachable, database exists (local mode)
//   2. db:dev:migrate — baseline on an empty DB + real migration runner
//   3. db:dev:seed    — demo shop (guarded to local hosts only)
//   4. start the backend and the frontend dev server
//   5. print the URLs
//
// If either server exits, or the orchestrator gets Ctrl+C/SIGTERM, both process
// trees are killed. On Windows this uses `taskkill /T /F`, so a failed Vite
// start cannot leave the backend holding port 5000.
//
// DEV_DB_MODE=local (backend/.env) means no Docker: 127.0.0.1:${DEV_DB_PORT},
// database spms_db, least-privilege app role. Without that file the historical
// Docker dev container is used. A remote DATABASE_URL in the shell is ignored.
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { loadDevEnv } = require('./dev-env');

const { mode } = loadDevEnv();
const {
  DEV_DB_NAME,
  DEV_DB_PORT,
  devDatabaseUrl,
  assertDatabaseUrl,
  isLocal,
} = require('./_guard');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DEV_DB = path.join(__dirname, 'dev-db.js');
const MODE = mode === 'local' ? 'local' : 'dev';
const BACKEND_PORT = Number(process.env.DEV_BACKEND_PORT || 5000);
const FRONTEND_PORT = Number(process.env.DEV_FRONTEND_PORT || 5173);
// POSIX children get their own process group so shutdown can signal the tree.
const POSIX_GROUP = process.platform !== 'win32';

const DEV_URL = devDatabaseUrl();
const identity = assertDatabaseUrl(DEV_URL, MODE);
if (!isLocal(DEV_URL)) {
  throw new Error(`refusing to start: dev database is not local (${identity.host})`);
}

function childEnv(extra = {}) {
  const env = {
    ...process.env,
    SPMS_DB_MODE: MODE,
    DATABASE_URL: DEV_URL,
    ...extra,
  };
  // The dev loop must never be able to reach a remote database.
  delete env.ALLOW_REMOTE_DB;
  delete env.RENDER;
  return env;
}

function runDb(command) {
  execFileSync(process.execPath, [DEV_DB, command], {
    cwd: BACKEND, stdio: 'inherit', env: childEnv(),
  });
}

function describeDatabase() {
  if (MODE === 'local') {
    return `${DEV_DB_NAME} on ${identity.host}:${DEV_DB_PORT} (native PostgreSQL, no Docker)`;
  }
  return `${DEV_DB_NAME} on ${identity.host}:${identity.port} (container spms_dev_db)`;
}

async function main() {
  console.log(`1/4 db:dev:preflight (${describeDatabase()})...`);
  runDb('preflight');

  console.log('2/4 db:dev:migrate...');
  runDb('migrate');

  console.log('3/4 db:dev:seed...');
  runDb('seed');

  if (process.argv.includes('--setup-only')) {
    console.log('setup-only: dev database, migrations and demo seed are ready; servers not started');
    return;
  }

  console.log('4/4 starting backend and frontend...');
  const backend = spawn(process.execPath, [path.join(BACKEND, 'src', 'app.js')], {
    cwd: BACKEND,
    stdio: 'inherit',
    detached: POSIX_GROUP,
    env: childEnv({
      NODE_ENV: 'development',
      PORT: String(BACKEND_PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me-0123456789',
      FRONTEND_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
      CORS_ORIGINS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT},http://127.0.0.1:4173`,
    }),
  });

  // Spawn vite directly (no npm/cmd wrapper) so Ctrl+C and the child-exit
  // handlers stop the process that actually owns the port on Windows.
  const frontend = spawn(process.execPath, [
    path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '127.0.0.1',
    '--port', String(FRONTEND_PORT),
    '--strictPort',
  ], {
    cwd: FRONTEND,
    stdio: 'inherit',
    // A new process group on POSIX lets shutdown signal the whole tree.
    detached: POSIX_GROUP,
    env: childEnv({ VITE_API_URL: `http://127.0.0.1:${BACKEND_PORT}/api` }),
  });

  let shuttingDown = false;

  function killTree(child) {
    if (!child || typeof child.pid !== 'number') return;
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-child.pid, 'SIGTERM');
      }
    } catch {
      // Already gone: taskkill exits non-zero, POSIX kill throws ESRCH.
    }
  }

  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    killTree(backend);
    killTree(frontend);
    process.exit(code);
  }

  process.on('SIGINT', () => shutdown(130));
  process.on('SIGTERM', () => shutdown(143));
  process.on('exit', () => {
    if (shuttingDown) return;
    shuttingDown = true;
    killTree(backend);
    killTree(frontend);
  });

  for (const [name, child] of [['backend', backend], ['frontend', frontend]]) {
    child.on('exit', (code, signal) => {
      console.log(`${name} exited (${signal || code}); stopping both servers`);
      shutdown(typeof code === 'number' ? code : 1);
    });
    child.on('error', err => {
      console.error(`${name} failed to start: ${err.message}`);
      shutdown(1);
    });
  }

  console.log('');
  console.log('dev ready');
  console.log(`  frontend: http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`  backend:  http://127.0.0.1:${BACKEND_PORT}  (health: /health)`);
  console.log(`  database: ${describeDatabase()}`);
  console.log('  stop with Ctrl+C');
}

main().catch(err => {
  console.error('dev start failed:', err.message);
  process.exit(1);
});
