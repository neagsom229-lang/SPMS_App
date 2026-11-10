// backend/tests/setup.js
process.env.NODE_ENV = 'test';
process.env.BAKONG_PROVIDER = process.env.BAKONG_PROVIDER || 'mock';
process.env.BAKONG_ACCOUNT_ID = process.env.BAKONG_ACCOUNT_ID || 'abaakhppxxx@abaa';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforunitandintegrationtesting123456789';

const isPostgresGuard = process.argv.some(arg => arg.includes('postgresGuard'));

if (!isPostgresGuard) {
  const { URL } = require('url');
  const db = require('../src/config/postgres');

  const dbUrl = process.env.DATABASE_URL;
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, '');

    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const endsWithTest = dbName.endsWith('_test');

    if (!isLocalhost || !endsWithTest) {
      console.error(`\n❌ REFUSING TO RUN TESTS: DATABASE_URL must point to localhost/127.0.0.1 and database name must end with '_test'.`);
      console.error(`   Current host: ${host}, Current database: ${dbName}\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Invalid DATABASE_URL in test setup:`, err.message);
    process.exit(1);
  }

  beforeEach(() => {
    delete global.mockVerifyResult;
  });

  afterAll(async () => {
    await db.end();
  });
}
