const fs = require('fs');
const path = require('path');
const db = require('../src/config/postgres');
require('dotenv').config();

console.log('🔍 Running migrations using established pool from ../src/config/postgres');

async function runMigrationsPass(passName) {
  const client = await db.connect();
  try {
    console.log(`--- RUNNING MIGRATION ${passName} ---`);
    console.log('🔄 Connected to database for migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, '../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files in ${migrationsDir}`);

    for (const file of files) {
      const checkRes = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (checkRes.rowCount > 0) {
        console.log(`⏭️ Migration already executed: ${file}`);
        continue;
      }

      console.log(`🚀 Executing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✅ Successfully executed and recorded: ${file}`);
    }

    console.log(`🎉 ${passName} completed successfully.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`❌ Migration ${passName} failed with error:`, err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function main() {
  await runMigrationsPass('PASS 1');
  await runMigrationsPass('PASS 2 (Idempotency Check)');
  console.log('🎉 All migration passes and idempotency checks passed successfully.');
  await db.end();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error in migration runner:', err.message);
    process.exit(1);
  });
}
