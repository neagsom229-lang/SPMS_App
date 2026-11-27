const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { sha256 } = require('./migration-checksum');
const { databaseUrl, assertDatabaseUrl } = require('./_guard');

const DB_MODE = process.env.SPMS_DB_MODE || 'test';
const MIGRATION_LOCK_KEY = 742917401; // fixed advisory lock key for SPMS migrations

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl(DB_MODE);
}
try {
  assertDatabaseUrl(process.env.DATABASE_URL, DB_MODE);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

const db = require('../src/config/postgres');

const parsed = new URL(process.env.DATABASE_URL);
const host = parsed.hostname;
const dbName = parsed.pathname.replace(/^\//, '');

console.log(`🔍 Running migrations on host: ${host}, database: ${dbName}`);

function migrationFiles() {
  const migrationsDir = path.join(__dirname, '../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }
  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;`);
}

async function verifyLedgerConsistency(client, files) {
  const dbRows = await client.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  const known = new Set(files);
  const unknown = dbRows.rows.filter(r => !known.has(r.filename)).map(r => r.filename);
  if (unknown.length > 0) {
    throw new Error(`Ledger contains unknown migration files (missing from disk): ${unknown.join(', ')}`);
  }

  for (const row of dbRows.rows) {
    if (!row.checksum) {
      console.warn(`⚠️ Legacy ledger row without checksum (not reconstructed): ${row.filename}`);
      continue;
    }
    const filePath = path.join(__dirname, '../../database/migrations', row.filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const actual = sha256(sql);
    if (actual !== row.checksum) {
      throw new Error(`Checksum mismatch for applied migration ${row.filename}. Existing migrations are immutable; create a new additive migration instead.`);
    }
  }
}

async function runMigrationsPass(passName) {
  const client = await db.connect();
  try {
    console.log(`--- RUNNING MIGRATION ${passName} ---`);
    console.log('🔄 Connected to database for migrations...');

    await ensureLedger(client);
    const files = migrationFiles();
    console.log(`📁 Found ${files.length} migration files in ${path.join(__dirname, '../../database/migrations')}`);

    await verifyLedgerConsistency(client, files);

    for (const file of files) {
      const filePath = path.join(__dirname, '../../database/migrations', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = sha256(sql);

      const checkRes = await client.query('SELECT filename, checksum FROM schema_migrations WHERE filename = $1', [file]);
      if (checkRes.rowCount > 0) {
        const existingChecksum = checkRes.rows[0].checksum;
        if (existingChecksum && existingChecksum !== checksum) {
          throw new Error(`Checksum mismatch for applied migration ${file}. Existing migrations are immutable; create a new additive migration instead.`);
        }
        if (!existingChecksum) {
          console.warn(`⚠️ Legacy applied migration without checksum: ${file}`);
        }
        console.log(`⏭️ Migration already executed: ${file}`);
        continue;
      }

      console.log(`🚀 Executing migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
      console.log(`✅ Successfully executed and recorded: ${file}`);
    }

    console.log(`🎉 ${passName} completed successfully.`);
  } finally {
    client.release();
  }
}

async function withMigrationLock(fn) {
  const lockClient = await db.connect();
  const lockTimeoutMs = Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 30000);
  try {
    console.log(`🔒 Acquiring migration advisory lock (${MIGRATION_LOCK_KEY}, timeout ${lockTimeoutMs}ms)...`);
    await lockClient.query(`SET lock_timeout = '${Math.max(1000, lockTimeoutMs)}ms'`);
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await lockClient.query('SET lock_timeout = DEFAULT');
    console.log('🔒 Migration advisory lock acquired.');
    return await fn();
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      console.log('🔓 Migration advisory lock released.');
    } catch (e) {
      console.warn(`⚠️ Failed to release migration advisory lock: ${e.message}`);
    }
    lockClient.release();
  }
}

async function main() {
  try {
    await withMigrationLock(async () => {
      await runMigrationsPass('PASS 1');
      await runMigrationsPass('PASS 2 (Idempotency Check)');
    });
    console.log('🎉 All migration passes and idempotency checks passed successfully.');
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error in migration runner:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { runMigrationsPass, withMigrationLock, sha256, verifyLedgerConsistency };