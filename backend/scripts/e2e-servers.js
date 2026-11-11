// backend/scripts/e2e-servers.js
//
// Playwright webServer entry point. Runs the e2e setup (unless E2E_SKIP_SETUP=1),
// then serves:
//   backend  http://127.0.0.1:5050  (test DB, NODE_ENV=development)
//   frontend http://127.0.0.1:4173  (vite preview of the built bundle)
// Both bind loopback only. The backend receives the test DATABASE_URL and no
// remote one, so it cannot reach a hosted database even by accident.
process.env.SPMS_DB_MODE = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = require('./_guard').testDatabaseUrl();
}

const path = require('path');
const { spawn } = require('child_process');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 5050);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4173);
const API = `http://127.0.0.1:${BACKEND_PORT}`;
const WEB = `http://127.0.0.1:${FRONTEND_PORT}`;

function childEnv(extra = {}) {
  const env = {
    ...process.env,
    SPMS_DB_MODE: 'test',
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: 'development',
    ...extra,
  };
  delete env.DIRECT_URL;
  delete env.ALLOW_REMOTE_DB;
  delete env.RENDER;
  return env;
}

async function waitFor(url, label, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      // not up yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not answer ${url} within ${timeoutMs}ms`);
}

async function main() {
  if (process.env.E2E_SKIP_SETUP !== '1') {
    const { setup } = require('./e2e-setup');
    await setup();
  }

  console.log('e2e servers: starting backend and frontend preview...');
  const backend = spawn(process.execPath, [path.join(BACKEND, 'src', 'app.js')], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: childEnv({
      PORT: String(BACKEND_PORT),
      JWT_SECRET: process.env.E2E_JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef',
      FRONTEND_URL: WEB,
      CORS_ORIGINS: `${WEB},http://localhost:${FRONTEND_PORT}`,
    }),
  });

  // Spawn vite directly (no npm/cmd wrapper) so the process Playwright kills
  // is the server itself; a surviving cmd.exe would keep the port bound.
  const vite = path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js');
  const frontend = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(FRONTEND_PORT), '--strictPort'], {
    cwd: FRONTEND,
    stdio: 'inherit',
    env: childEnv(),
  });

  let stopping = false;
  const stop = signal => {
    if (stopping) return;
    stopping = true;
    for (const child of [backend, frontend]) {
      if (child && !child.killed) child.kill(signal);
    }
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('exit', () => stop('SIGTERM'));
  backend.on('exit', code => {
    if (!stopping) {
      console.error(`e2e backend exited with code ${code}`);
      stop('SIGTERM');
      process.exit(code === 0 ? 1 : code);
    }
  });
  frontend.on('exit', code => {
    if (!stopping) {
      console.error(`e2e frontend exited with code ${code}`);
      stop('SIGTERM');
      process.exit(code === 0 ? 1 : code);
    }
  });

  await waitFor(`${API}/health`, 'backend');
  await waitFor(WEB, 'frontend preview');
  console.log(`e2e servers ready: backend ${API} frontend ${WEB}`);
}

main().catch(err => {
  console.error('e2e servers failed:', err.message);
  process.exit(1);
});
