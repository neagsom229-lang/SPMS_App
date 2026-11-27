// backend/scripts/rehearse.js  (OWNER-RUN ONLY)
//
//   node backend/scripts/rehearse.js <path-to-schema-only-prod-dump.sql>
//
// Loads a schema-only production dump into a scratch *_test database inside the
// local test container (pre-creating the Supabase-managed "extensions" schema
// and skipping supabase_vault/publication statements in memory, printing every
// skipped line; the dump file is never modified), marks the migration ledger
// 001-014 only, runs the real runner for 015+, then prints (1) the schema
// signature diff between the resulting database and the dump (= the production
// deploy plan) and (2) a drift report of that database against a freshly built
// spms_test (baseline + migrations).
//
// Never connects to a remote host: the guard refuses anything but 127.0.0.1.
process.env.SPMS_DB_MODE = 'test';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { TEST_DB_CONTAINER, TEST_DB_PORT, TEST_DB_NAME, testDatabaseUrl, assertTestDatabaseUrl } = require('./_guard');
const { migrationFilesFrom, buildTestDatabase } = require('./test-db');

const SCRATCH = 'spms_rehearse_test';
const BASELINE_MAX = 14;

function assertLocal() {
  const identity = assertTestDatabaseUrl(testDatabaseUrl(SCRATCH));
  if (!identity.database.endsWith('_test')) {
    throw new Error(`refusing: scratch database ${identity.database} does not end with _test`);
  }
  return identity;
}

function loadDump(dumpPath) {
  const sql = fs.readFileSync(dumpPath, 'utf8');
  const container = process.env.TEST_DB_CONTAINER || TEST_DB_CONTAINER;

  // F7: the dump references schema "extensions" (CREATE EXTENSION ... WITH
  // SCHEMA "extensions") but never creates it -> psql:<stdin>:20: ERROR:
  // schema "extensions" does not exist. The schema is pre-created locally;
  // the dump file itself is never modified.
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', SCRATCH, '-v', 'ON_ERROR_STOP=1', '-q', '-c', 'CREATE SCHEMA IF NOT EXISTS "extensions"'],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );

  // Supabase-managed statements cannot run in the local container:
  //   - supabase_vault (and its vault schema) is Supabase-managed
  //   - the supabase_realtime publication does not exist locally
  // They are skipped in memory only, and every skipped line is printed.
  const SKIP_RE = /^(?:CREATE|ALTER)\s+PUBLICATION\b|CREATE\s+EXTENSION[^;]*supabase_vault/i;
  const kept = [];
  const skipped = [];
  sql.split(/\r?\n/).forEach((line, i) => {
    if (SKIP_RE.test(line.trim())) skipped.push(`${i + 1}: ${line.trim()}`);
    else kept.push(line);
  });
  console.log(`  skipped (supabase-managed): ${skipped.length} line(s)`);
  skipped.forEach(s => console.log(`    ${s}`));

  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', SCRATCH, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    { input: kept.join('\n'), stdio: ['pipe', 'inherit', 'inherit'], maxBuffer: 1024 * 1024 * 256 }
  );
}

async function recreate(database) {
  const admin = new Client({ connectionString: testDatabaseUrl('postgres') });
  admin.on('error', () => {});
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${database}`);
  } finally {
    await admin.end();
  }
}

async function markBaselineLedger() {
  const files = migrationFilesFrom(1, BASELINE_MAX);
  const client = new Client({ connectionString: testDatabaseUrl(SCRATCH) });
  client.on('error', () => {});
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query('DELETE FROM schema_migrations');
    for (const file of files) {
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }
    return files.length;
  } finally {
    await client.end();
  }
}

async function signature(database = SCRATCH) {
  const client = new Client({ connectionString: testDatabaseUrl(database) });
  client.on('error', () => {});
  await client.connect();
  try {
    const res = await client.query(`
      SELECT kind, entry FROM (
        SELECT 'table' AS kind, table_schema || '.' || table_name AS entry
          FROM information_schema.tables WHERE table_schema = 'public'
        UNION ALL
        SELECT 'column', table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable
          FROM information_schema.columns WHERE table_schema = 'public'
        UNION ALL
        SELECT 'index', indexname || ' ' || indexdef
          FROM pg_indexes WHERE schemaname = 'public'
        UNION ALL
        SELECT 'constraint', conname || ' ' || pg_get_constraintdef(oid)
          FROM pg_constraint WHERE connamespace = 'public'::regnamespace
      ) s ORDER BY kind, entry
    `);
    return res.rows.map(r => `${r.kind}: ${r.entry}`);
  } finally {
    await client.end();
  }
}

function runRunner() {
  return execFileSync(process.execPath, [path.join(__dirname, 'run_migration.js')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SPMS_DB_MODE: 'test',
      DATABASE_URL: testDatabaseUrl(SCRATCH),
      TEST_DB_PORT: String(TEST_DB_PORT),
    },
  });
}

function diff(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  const removed = before.filter(x => !a.has(x));
  const added = after.filter(x => !b.has(x));
  return { removed, added };
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: node backend/scripts/rehearse.js <schema-only-prod-dump.sql>');
    process.exit(1);
  }
  if (!fs.existsSync(dumpPath)) {
    console.error(`dump not found: ${dumpPath}`);
    process.exit(1);
  }

  const identity = assertLocal();
  console.log(`scratch database: ${identity.database} on ${identity.host}:${identity.port} (container ${TEST_DB_CONTAINER})`);
  console.log(`dump: ${path.resolve(dumpPath)}`);

  await recreate(SCRATCH);
  console.log('1/5 loading the schema-only dump...');
  loadDump(dumpPath);

  const dumpSignature = await signature();
  console.log(`2/5 dump signature: ${dumpSignature.length} entries`);

  const marked = await markBaselineLedger();
  console.log(`3/5 ledger set to 001-014 (${marked} rows)`);

  console.log('4/5 running the real runner for 015+...');
  const out = runRunner();
  console.log(out.trim().split(/\r?\n/).slice(-3).join('\n'));

  const after = await signature();
  console.log(`5/5 resulting signature: ${after.length} entries`);

  const d = diff(dumpSignature, after);
  console.log('');
  console.log('=== (1) schema signature diff (dump -> after 015-028) = deploy plan ===');
  if (d.removed.length === 0 && d.added.length === 0) {
    console.log('no difference: the runner is a no-op on this production schema');
  } else {
    d.removed.forEach(x => console.log(`- ${x}`));
    d.added.forEach(x => console.log(`+ ${x}`));
    console.log('');
    console.log(`deploy plan: ${d.removed.length} removed, ${d.added.length} added`);
  }

  // (2) drift report: (live dump + 015-028) vs a freshly built spms_test
  // (baseline + 015-028) - every object present on one side only.
  console.log('');
  console.log('=== (2) drift report: (dump + 015-028) vs fresh spms_test (baseline + 015-028) ===');
  const freshBuild = await buildTestDatabase(TEST_DB_NAME);
  console.log(`fresh ${TEST_DB_NAME}: baseline loaded, ledger=${freshBuild.ledger.total}`);
  const fresh = await signature(TEST_DB_NAME);
  const drift = diff(after, fresh);
  if (drift.removed.length === 0 && drift.added.length === 0) {
    console.log('no drift: both sides have identical public-schema signatures');
  } else {
    drift.removed.forEach(x => console.log(`only in (dump + migrations): ${x}`));
    drift.added.forEach(x => console.log(`only in fresh spms_test:       ${x}`));
    console.log(`drift: ${drift.removed.length} only-dump-side, ${drift.added.length} only-test-side`);
  }

  await recreate(SCRATCH);
  console.log(`scratch database ${SCRATCH} dropped`);
}

main().catch(err => {
  console.error('rehearse failed:', err.message);
  process.exit(1);
});
