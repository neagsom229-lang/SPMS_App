// backend/tests/setup.js
process.env.NODE_ENV = 'test';
process.env.BAKONG_ACCOUNT_ID = process.env.BAKONG_ACCOUNT_ID || 'abaakhppxxx@abaa';
const { testDatabaseUrl, assertTestDatabaseUrl } = require('../scripts/_guard');
const { workerDatabaseName } = require('./test-databases');

const isPostgresGuard = process.argv.some(arg => arg.includes('postgresGuard'));

if (!isPostgresGuard) {
  const workerId = Number(process.env.JEST_WORKER_ID || 1);
  process.env.DATABASE_URL = testDatabaseUrl(workerDatabaseName(workerId));
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = testDatabaseUrl();
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforunitandintegrationtesting123456789';

if (!isPostgresGuard) {
  const db = require('../src/config/postgres');

  try {
    assertTestDatabaseUrl();
  } catch (err) {
    console.error(`\n❌ REFUSING TO RUN TESTS: ${err.message}`);
    process.exit(1);
  }

  beforeEach(() => {
    delete global.mockVerifyResult;
  });

  afterAll(async () => {
    await db.end();
  });
}
