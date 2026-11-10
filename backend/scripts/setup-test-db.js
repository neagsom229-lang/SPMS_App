process.env.NODE_ENV = 'test';
const { testDatabaseUrl, assertTestDatabaseUrl } = require('./_guard');
process.env.DATABASE_URL = testDatabaseUrl();
process.env.DIRECT_URL = process.env.DATABASE_URL;
assertTestDatabaseUrl();

const { Client } = require('pg');
const { buildTestDatabase } = require('./test-db');

async function ensureRoles() {
  const client = new Client({ connectionString: testDatabaseUrl('postgres') });
  await client.connect();
  try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await client.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
             CREATE ROLE ${role};
           END IF;
         END $$;`
      );
    }
  } finally {
    await client.end();
  }
}

async function setup() {
  await ensureRoles();
  const result = await buildTestDatabase();
  console.log(`✅ spms_test built: baseline + ledger 001-014 (${result.marked}) + real runner 015-026 (ledger=${result.ledger.total})`);
}

setup().catch(err => {
  console.error('❌ Test DB setup failed:', err.message);
  process.exit(1);
});
