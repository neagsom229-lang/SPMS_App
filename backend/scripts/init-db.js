const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function init() {
  const adminPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/postgres' });
  try {
    await adminPool.query('CREATE DATABASE spms');
    console.log('✅ Created database spms on port 5433');
  } catch (err) {
    console.log('ℹ️ Database spms might already exist:', err.message);
  } finally {
    await adminPool.end();
  }

  const dbPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/spms' });
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    await dbPool.query(schemaSql);
    console.log('✅ Executed schema.sql on spms');
  } catch (err) {
    console.error('❌ Schema execution failed:', err.message);
  } finally {
    await dbPool.end();
  }

  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms';
  try {
    execSync('node run_migration.js', { stdio: 'inherit', env: process.env, cwd: __dirname });
    console.log('✅ Migrations completed successfully on spms');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
}

init();
