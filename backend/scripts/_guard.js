// Database connection security guard + single source of truth for local DBs.
//
// Three modes, all reachable only through 127.0.0.1:
//   test  (default): disposable container, tmpfs data dir, database ends _test
//   dev:             long-lived container, named volume, database ends _dev
//   local:           native PostgreSQL installed on Windows (no Docker),
//                    DATABASE_URL from backend/.env, database spms_db
//
// Fails closed: a DATABASE_URL that is not the current mode's local URL on
// that mode's port and database stops the process before connecting.
const { URL } = require('url');
const { execFileSync } = require('child_process');
const net = require('net');

const DB_HOST = '127.0.0.1';

const DEFAULT_TEST_DB_PORT = 15432;
const TEST_DB_PORT = Number(process.env.TEST_DB_PORT || DEFAULT_TEST_DB_PORT);
const TEST_DB_NAME = 'spms_test';
const TEST_TEMPLATE_NAME = 'spms_template';
const TEST_DB_CONTAINER = 'spms_test_db';

// DEV_DB_MODE=local selects the native PostgreSQL install. Anything else keeps
// the historical Docker dev database, so existing checkouts keep working.
const DEV_DB_MODE = process.env.DEV_DB_MODE === 'local' ? 'local' : 'docker';
const DEFAULT_DEV_DB_PORT = DEV_DB_MODE === 'local' ? 5432 : 15433;
const DEV_DB_PORT = Number(process.env.DEV_DB_PORT || DEFAULT_DEV_DB_PORT);
const DEV_DB_NAME = process.env.DEV_DB_NAME || (DEV_DB_MODE === 'local' ? 'spms_db' : 'spms_dev');
const DEV_DB_CONTAINER = DEV_DB_MODE === 'local' ? null : 'spms_dev_db';
const DEV_DB_VOLUME = DEV_DB_MODE === 'local' ? null : 'spms_dev_pgdata';
const LOCAL_DB_USER = process.env.DEV_DB_USER || 'spms_app';

const DB_USER = 'postgres';
const DB_PASSWORD = 'postgres';

const MODES = {
  test: {
    name: 'test',
    host: DB_HOST,
    port: TEST_DB_PORT,
    database: TEST_DB_NAME,
    template: TEST_TEMPLATE_NAME,
    container: TEST_DB_CONTAINER,
    volume: null,
    storage: 'tmpfs',
    suffix: '_test',
  },
  dev: {
    name: 'dev',
    host: DB_HOST,
    port: DEV_DB_PORT,
    database: DEV_DB_NAME,
    template: null,
    container: DEV_DB_CONTAINER,
    volume: DEV_DB_VOLUME,
    storage: 'volume',
    suffix: '_dev',
  },
  local: {
    name: 'local',
    host: DB_HOST,
    port: DEV_DB_PORT,
    database: DEV_DB_NAME,
    template: null,
    container: null,
    volume: null,
    storage: null,
    suffix: null,
    user: LOCAL_DB_USER,
  },
};

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

function modeConfig(mode = 'test') {
  const config = MODES[mode];
  if (!config) {
    throw new Error(`unknown database mode "${mode}" (expected test or dev)`);
  }
  return config;
}

function parseDbUrl(value) {
  try {
    const u = new URL(value);
    return {
      host: u.hostname,
      port: Number(u.port || 5432),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch (e) {
    return null;
  }
}

function isLocalHost(host) {
  return LOCAL_HOSTS.includes(host);
}

function isLocal(urlStr) {
  const parsed = parseDbUrl(urlStr);
  return !!parsed && isLocalHost(parsed.host);
}

function databaseUrl(mode = 'test', database = modeConfig(mode).database) {
  const config = modeConfig(mode);
  if (mode === 'local') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for local mode (put it in backend/.env)');
    }
    return process.env.DATABASE_URL;
  }
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${config.host}:${config.port}/${database}`;
}

// Backwards-compatible name used by the test runner and globalSetup.
function testDatabaseUrl(database = TEST_DB_NAME) {
  return databaseUrl('test', database);
}

function devDatabaseUrl(database = DEV_DB_NAME) {
  if (DEV_DB_MODE === 'local') {
    if (database !== DEV_DB_NAME) {
      throw new Error(`local mode has a single dev database (${DEV_DB_NAME})`);
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for local mode (put it in backend/.env)');
    }
    return process.env.DATABASE_URL;
  }
  return databaseUrl('dev', database);
}

function assertDatabaseUrl(urlStr, mode = 'test') {
  const config = modeConfig(mode);
  if (!urlStr) {
    throw new Error(`${mode === 'dev' ? 'DEV_' : ''}DATABASE_URL is required`);
  }
  const parsed = parseDbUrl(urlStr);
  if (!parsed) {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (parsed.host !== config.host) {
    throw new Error(`DATABASE_URL host must be ${config.host} (${mode} mode)`);
  }
  if (parsed.port !== config.port) {
    throw new Error(`DATABASE_URL port must be ${config.port} (${mode} mode)`);
  }
  if (mode === 'local') {
    if (parsed.database !== config.database) {
      throw new Error(`DATABASE_URL database must be ${config.database} (local mode)`);
    }
    const user = new URL(urlStr).username;
    if (user === 'postgres') {
      throw new Error('local mode must connect as the least-privilege app role (spms_app), not postgres');
    }
    return parsed;
  }
  if (!parsed.database.endsWith(config.suffix)) {
    throw new Error(`DATABASE_URL database name must end with ${config.suffix}`);
  }
  return parsed;
}

function assertTestDatabaseUrl(urlStr = process.env.DATABASE_URL) {
  return assertDatabaseUrl(urlStr, 'test');
}

function assertDevDatabaseUrl(urlStr = process.env.DATABASE_URL) {
  return assertDatabaseUrl(urlStr, DEV_DB_MODE === 'local' ? 'local' : 'dev');
}

const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const mode = process.env.SPMS_DB_MODE || 'test';
  try {
    assertDatabaseUrl(dbUrl, mode);
  } catch (e) {
    console.error(`❌ REFUSING TO TOUCH DATABASE: ${e.message}`);
    process.exit(1);
  }
}

// Preflight for a local Docker database. Call only when the DB is NOT reachable
// — a running container already owns the port. Errors carry a code so callers
// fail fast with a clear, Windows-friendly hint. portVarName makes the hint name
// the right setting (TEST_DB_PORT / DEV_DB_PORT).
async function assertPortBindable(port = TEST_DB_PORT, portVarName = 'TEST_DB_PORT') {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
            const e = new Error(
        err.code === 'EADDRINUSE'
          ? `Port ${port} is already in use (a database may already be running there): stop that process or set ${portVarName}`
          : `Port ${port} cannot be bound (${err.code}); on Windows it may be reserved: run \`netsh interface ipv4 show excludedportrange protocol=tcp\`, or set ${portVarName}`
      );
      e.code = 'PORT_UNAVAILABLE';
      e.cause = err.message;
      reject(e);
    });
    server.once('listening', () => server.close(resolve));
    server.listen(port, DB_HOST);
  });
}

async function preflightDocker(port, portVarName) {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 15000 });
  } catch (e) {
    const err = new Error('Start Docker Desktop');
    err.code = 'DOCKER_NOT_READY';
    err.cause = (e.message || '').split(/\r?\n/)[0];
    throw err;
  }
  await assertPortBindable(port, portVarName);
}

async function preflightTestDocker(port = TEST_DB_PORT) {
  return preflightDocker(port, 'TEST_DB_PORT');
}

async function preflightDevDocker(port = DEV_DB_PORT) {
  return preflightDocker(port, 'DEV_DB_PORT');
}

module.exports = {
  DB_HOST,
  DEFAULT_TEST_DB_PORT,
  TEST_DB_PORT,
  TEST_DB_NAME,
  TEST_TEMPLATE_NAME,
  TEST_DB_CONTAINER,
  DEFAULT_DEV_DB_PORT,
  DEV_DB_MODE,
  DEV_DB_PORT,
  DEV_DB_NAME,
  DEV_DB_CONTAINER,
  DEV_DB_VOLUME,
  LOCAL_DB_USER,
  DB_USER,
  DB_PASSWORD,
  // legacy aliases
  TEST_DB_USER: DB_USER,
  TEST_DB_PASSWORD: DB_PASSWORD,
  MODES,
  modeConfig,
  testDatabaseUrl,
  devDatabaseUrl,
  databaseUrl,
  assertDatabaseUrl,
  assertTestDatabaseUrl,
  assertDevDatabaseUrl,
  parseDbUrl,
  isLocal,
  isLocalHost,
  assertPortBindable,
  preflightDocker,
  preflightTestDocker,
  preflightDevDocker,
};
