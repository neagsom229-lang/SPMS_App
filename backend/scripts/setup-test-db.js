const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function setup() {
  const adminPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/postgres' });
  try {
    await adminPool.query('DROP DATABASE IF EXISTS spms_test');
    await adminPool.query('CREATE DATABASE spms_test');
    console.log('✅ Created spms_test database on port 5433');
  } catch (err) {
    console.error('❌ Error setting up test db:', err.message);
  } finally {
    await adminPool.end();
  }

  // Connect to spms_test and execute schema.sql
  const testPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/spms_test' });
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    await testPool.query(schemaSql);
    console.log('✅ Executed database/schema.sql on spms_test');
  } catch (err) {
    console.error('❌ Schema execution failed:', err.message);
  } finally {
    await testPool.end();
  }

  // Run migrations on spms_test
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/spms_test';
  try {
    execSync('node run_migration.js', { stdio: 'inherit', env: process.env, cwd: __dirname });
    console.log('✅ Ran migrations on spms_test');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
}

setup();
