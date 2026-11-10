// Database connection security guard + single source of truth for the test DB.
// Fails closed: any DATABASE_URL/DIRECT_URL that is not a valid local *_test URL
// on TEST_DB_PORT stops the process before a connection can be opened.
const { URL } = require('url');

const TEST_DB_HOST = '127.0.0.1';
const TEST_DB_PORT = Number(process.env.TEST_DB_PORT || 55432);
const TEST_DB_USER = 'postgres';
const TEST_DB_PASSWORD = 'postgres';
const TEST_DB_NAME = 'spms_test';
const TEST_TEMPLATE_NAME = 'spms_template';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

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

function testDatabaseUrl(database = TEST_DB_NAME) {
  return `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${database}`;
}

function assertTestDatabaseUrl(urlStr = process.env.DATABASE_URL) {
  if (!urlStr) {
    throw new Error('DATABASE_URL is required');
  }
  const parsed = parseDbUrl(urlStr);
  if (!parsed) {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (!isLocalHost(parsed.host)) {
    throw new Error('DATABASE_URL host must be localhost, 127.0.0.1 or ::1');
  }
  if (parsed.port !== TEST_DB_PORT) {
    throw new Error(`DATABASE_URL port must be TEST_DB_PORT (${TEST_DB_PORT})`);
  }
  if (!parsed.database.endsWith('_test')) {
    throw new Error('DATABASE_URL database name must end with _test');
  }
  return parsed;
}

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (dbUrl) {
  try {
    assertTestDatabaseUrl(dbUrl);
  } catch (e) {
    console.error(`❌ REFUSING TO TOUCH DATABASE: ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  TEST_DB_HOST,
  TEST_DB_PORT,
  TEST_DB_USER,
  TEST_DB_PASSWORD,
  TEST_DB_NAME,
  TEST_TEMPLATE_NAME,
  testDatabaseUrl,
  assertTestDatabaseUrl,
  parseDbUrl,
  isLocal,
  isLocalHost,
};
