// backend/tests/globalSetup.js
const { Client } = require('pg');
const { TEST_DB_NAME, testDatabaseUrl, assertTestDatabaseUrl } = require('../scripts/_guard');
const { buildTestDatabase, productionReplayCheck } = require('../scripts/test-db');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = testDatabaseUrl(TEST_DB_NAME);
  }
  const identity = assertTestDatabaseUrl();

  // baseline.sql = state after 014. Ledger is marked 001-014 only, then the
  // real runner performs the 015-026 upgrade.
  const build = await buildTestDatabase(TEST_DB_NAME);
  console.log(`baseline loaded; ledger marked 001-014 (${build.marked} rows); runner applied 015-026 (ledger=${build.ledger.total})`);
  console.log(build.out.trim().split(/\r?\n/).slice(-3).join('\n'));

  // Replay the real upgrade path on a DB whose schema already has 015-026.
  const replay = await productionReplayCheck();
  console.log(`production replay: ledger before=${replay.before.ledger}, webhook table existed=${replay.before.webhook_table}, runner exit 0, ledger after=${replay.ledger.total}, schema_unchanged=${replay.schemaUnchanged}`);
  console.log(replay.out.trim().split(/\r?\n/).slice(-2).join('\n'));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(
      `select version() as version,
              current_database() as database,
              (select count(*) from pg_roles
                where rolname in ('anon', 'authenticated', 'service_role', 'supabase_admin')) as required_roles`
    );
    const row = res.rows[0];
    console.table([{
      host: identity.host,
      port: identity.port,
      database: row.database,
      postgres_version: row.version,
      required_roles: Number(row.required_roles),
    }]);
    if (!String(row.version).startsWith('PostgreSQL 17')) {
      console.error(`❌ FATAL: PostgreSQL version must start with PostgreSQL 17 (got: ${row.version})`);
      process.exit(1);
    }
    if (Number(row.required_roles) !== 4) {
      console.error(`❌ FATAL: expected roles anon, authenticated, service_role, supabase_admin (got ${row.required_roles})`);
      process.exit(1);
    }
    await client.end();
  } catch (err) {
    throw new Error(`❌ FATAL: database identity check failed in globalSetup: ${err.message}`);
  }
};
