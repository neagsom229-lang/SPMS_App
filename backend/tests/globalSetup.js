// backend/tests/globalSetup.js
const { URL } = require('url');
const { Client } = require('pg');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test';
  require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });

  const dbUrl = process.env.DATABASE_URL;
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) {
      throw new Error(`❌ FATAL: Test database host must be localhost or 127.0.0.1 (got: ${host}). Tests must never touch production/pooler!`);
    }

    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const res = await client.query('SELECT current_database(), inet_server_addr(), inet_server_port();');
    console.table([res.rows[0]]);
    await client.end();
  } catch (err) {
    throw new Error(`❌ FATAL: Invalid or non-local DATABASE_URL / DB query in globalSetup: ${err.message}`);
  }
};
