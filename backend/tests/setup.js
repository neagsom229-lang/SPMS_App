// backend/tests/setup.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/spms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforunitandintegrationtesting123456789';

const { URL } = require('url');

const dbUrl = process.env.DATABASE_URL;
console.log('DEBUG dbUrl:', dbUrl);
try {
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '');
  console.log('DEBUG host:', host, 'dbName:', dbName);

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
