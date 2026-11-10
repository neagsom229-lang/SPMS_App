// backend/tests/globalSetup.js
const { Client } = require('pg');
const { testDatabaseUrl, assertTestDatabaseUrl } = require('../scripts/_guard');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = testDatabaseUrl();
  }

  const identity = assertTestDatabaseUrl();
  const host = identity.host;
  const port = identity.port;

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
      host,
      port,
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
