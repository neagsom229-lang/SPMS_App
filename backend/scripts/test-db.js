// Single, real upgrade path for every local test database.
//
//   1. load database/baseline.sql   (schema after migration 014, no data)
//   2. mark ONLY migrations 001-014 as applied
//   3. run every migration after the baseline through scripts/run_migration.js
//      (the real runner)
//
// productionReplayCheck() additionally proves the runner is a no-op when the
// effects of 015-LATEST already exist but the ledger still stops at 014.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { TEST_DB_PORT, TEST_DB_NAME, testDatabaseUrl } = require('./_guard');

const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const BASELINE = path.join(ROOT, 'database', 'baseline.sql');
const MIGRATIONS = path.join(ROOT, 'database', 'migrations');
const REPLAY_DB = 'spms_replay_test';
const BASELINE_MAX = 14;
const LATEST = 30;

function migrationFilesFrom(min, max) {
  return fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .filter(f => {
      const n = Number(f.slice(0, 3));
      return n >= min && n <= max;
    })
    .sort();
}

function readSql(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

async function withClient(database, fn) {
  const client = new Client({ connectionString: testDatabaseUrl(database) });
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function recreateDatabase(name) {
  await withClient('postgres', async admin => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
  });
}

async function ledgerRange(name) {
  return withClient(name, async client => {
    const res = await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE filename < '015')::int AS through_014
       FROM schema_migrations`
    );
    return res.rows[0];
  });
}

async function loadBaseline(name) {
  await recreateDatabase(name);
  const files = migrationFilesFrom(1, BASELINE_MAX);
  const marked = await withClient(name, async client => {
    await client.query(readSql(BASELINE));
    await client.query('SET search_path TO public');
    for (const file of files) {
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }
    return files.length;
  });

  const ledger = await ledgerRange(name);
  if (ledger.total !== marked || ledger.through_014 !== marked) {
    throw new Error(`baseline ledger must contain exactly 001-014 (got total=${ledger.total}, through_014=${ledger.through_014})`);
  }
  return marked;
}

// Schema signature straight from the catalog, over the same pg connection as
// everything else. Deliberately no `docker exec`/`pg_dump` shell-out: a CI job
// serves the test database from a service container whose name is not
// spms_test_db, so the fingerprint must not depend on the container name.
async function schemaFingerprint(name) {
  return withClient(name, async client => {
    const { rows } = await client.query(`
      WITH objects AS (
        SELECT 'column' AS kind, c.relname AS object, a.attname AS name,
               format_type(a.atttypid, a.atttypmod) AS definition,
               a.attnotnull AS not_null,
               COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS default_expr,
               a.attnum AS position
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE n.nspname = 'public'
           AND c.relkind IN ('r', 'p')
           AND a.attnum > 0
           AND NOT a.attisdropped
        UNION ALL
        SELECT 'index', tablename, indexname, indexdef, false, '', 0
          FROM pg_indexes
         WHERE schemaname = 'public'
        UNION ALL
        SELECT 'constraint', c.relname, k.conname, pg_get_constraintdef(k.oid), false, '', 0
          FROM pg_constraint k
          JOIN pg_class c ON c.oid = k.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
      )
      SELECT kind, object, name, definition, not_null, default_expr, position
        FROM objects
       ORDER BY kind, object, name, position
    `);
    return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  });
}

function runRealRunner(name) {
  return execFileSync(process.execPath, [path.join(BACKEND, 'scripts', 'run_migration.js')], {
    cwd: BACKEND,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl(name), TEST_DB_PORT: String(TEST_DB_PORT) },
  });
}

async function assertLedgerComplete(name) {
  const ledger = await ledgerRange(name);
  if (ledger.total !== LATEST) {
    throw new Error(`expected ${LATEST} applied migrations after runner, got ${ledger.total}`);
  }
  return ledger;
}

async function buildTestDatabase(name = TEST_DB_NAME) {
  const marked = await loadBaseline(name);
  const out = runRealRunner(name);
  const ledger = await assertLedgerComplete(name);
  return { marked, out, ledger };
}

async function productionReplayCheck(name = REPLAY_DB) {
  const marked = await loadBaseline(name);
  try {
    // Simulate a database where 015-026 effects already exist, but the ledger
    // still shows only 001-014 (the real upgrade path must be a no-op).
    await withClient(name, async client => {
      for (const file of migrationFilesFrom(15, LATEST)) {
        await client.query(readSql(path.join(MIGRATIONS, file)));
      }
    });

    const before = await withClient(name, async client => {
      const res = await client.query(
        `SELECT to_regclass('public.khqr_webhook_events') IS NOT NULL AS webhook_table,
                (SELECT count(*)::int FROM schema_migrations) AS ledger`
      );
      return res.rows[0];
    });
    if (!before.webhook_table || before.ledger !== marked) {
      throw new Error('replay database was not prepared with 015-026 effects and a 001-014 ledger');
    }

    const schemaBefore = await schemaFingerprint(name);
    const out = runRealRunner(name);
    const schemaAfter = await schemaFingerprint(name);
    if (schemaBefore !== schemaAfter) {
      throw new Error('production replay was not a no-op: schema changed when the runner replayed 015-026');
    }
    const ledger = await assertLedgerComplete(name);
    return { marked, out, ledger, before, schemaUnchanged: true };
  } finally {
    await withClient('postgres', async admin => {
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    });
  }
}

module.exports = {
  BASELINE,
  MIGRATIONS,
  REPLAY_DB,
  migrationFilesFrom,
  readSql,
  loadBaseline,
  runRealRunner,
  buildTestDatabase,
  productionReplayCheck,
  ledgerRange,
};
