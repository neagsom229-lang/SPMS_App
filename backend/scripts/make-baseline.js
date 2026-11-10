#!/usr/bin/env node
// Builds database/baseline.sql from a LOCAL scratch database only.
//
// Source of truth:
//   1. database/schema.sql        (the base tables the application expects)
//   2. database/migrations/001..014 (the repository's own migrations)
//
// It never reads a remote database and never reads .env. The scratch database
// lives on TEST_DB_PORT (127.0.0.1) inside the throw-away docker container and
// is dropped again when the dump is finished.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { TEST_DB_PORT, assertTestDatabaseUrl, testDatabaseUrl } = require('./_guard');

const ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS = path.join(ROOT, 'database', 'migrations');
const SCHEMA_SQL = path.join(ROOT, 'database', 'schema.sql');
const SCRATCH_DB = 'spms_baseline_test';
const CONTAINER = process.env.TEST_DB_CONTAINER || 'spms_test_db';
const BASELINE_MAX_MIGRATION = 14;

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function migrationFiles(maxPrefix) {
  return fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .filter(f => Number(f.slice(0, 3)) <= maxPrefix)
    .sort();
}

async function withClient(connectionString, fn) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function main() {
  // The scratch database is always local and always ends in _test. Ignore any
  // inherited DATABASE_URL so this script can never hit a remote database.
  process.env.DATABASE_URL = testDatabaseUrl(SCRATCH_DB);
  assertTestDatabaseUrl();

  const out = path.resolve(argValue('--out', path.join(ROOT, 'database', 'baseline.sql')));

  if (!fs.existsSync(SCHEMA_SQL)) {
    throw new Error(`missing ${path.relative(ROOT, SCHEMA_SQL)} (base tables are required)`);
  }

  await withClient(testDatabaseUrl('postgres'), async admin => {
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
  });

  try {
    await withClient(testDatabaseUrl(SCRATCH_DB), async client => {
      console.log(`applying repository schema: ${path.relative(ROOT, SCHEMA_SQL)}`);
      await client.query(fs.readFileSync(SCHEMA_SQL, 'utf8'));

      for (const file of migrationFiles(BASELINE_MAX_MIGRATION)) {
        console.log(`applying ${file}`);
        await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
      }

      // The runner creates this ledger. It is part of the state after 014, but
      // deliberately kept empty so the baseline contains no data.
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename VARCHAR(255) PRIMARY KEY,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    });

    console.log(`dumping schema-only from local container ${CONTAINER} (127.0.0.1:${TEST_DB_PORT}/${SCRATCH_DB})`);
    let dump = execFileSync('docker', [
      'exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', SCRATCH_DB,
      '--schema-only', '--no-owner',
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });

    // PostgreSQL 17.6+ emits psql-only \restrict/\unrestrict guards. The Node
    // pg client cannot execute psql meta-commands, so drop those two lines.
    dump = dump.split(/\r?\n/)
      .filter(line => !/^\\(un)?restrict\b/.test(line))
      .join('\n');

    const dataLines = dump.split(/\r?\n/).filter(line => /^(INSERT|COPY)\b/.test(line));
    if (dataLines.length > 0) {
      throw new Error(`refusing to write a baseline containing data (${dataLines.length} INSERT/COPY lines)`);
    }

    const forbidden = [
      'khqr_sessions',
      'khqr_webhook_events',
      'tenant_order_counters',
      'must_change_password',
      'token_version',
      'plan_expires_at',
    ].filter(token => dump.includes(token));
    if (forbidden.length > 0) {
      throw new Error(`baseline contains objects from migrations after 014: ${forbidden.join(', ')}`);
    }

    fs.writeFileSync(out, dump);
    console.log(`wrote ${out} (${dump.split('\n').length} lines, 0 data statements)`);
  } finally {
    await withClient(testDatabaseUrl('postgres'), async cleanup => {
      await cleanup.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    });
  }
}

main().catch(err => {
  console.error(`❌ make-baseline failed: ${err.message}`);
  process.exit(1);
});
