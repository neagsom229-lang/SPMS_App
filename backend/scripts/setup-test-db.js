process.env.NODE_ENV = 'test';
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../.env.test'), override: true }); } catch (e) {}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/spms_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
require('./_guard');
const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');

async function setup() {
  const adminPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/postgres' });
  try {
    await adminPool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF; END $$;");
    await adminPool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;");
    await adminPool.query('DROP DATABASE IF EXISTS spms_test');
    await adminPool.query('CREATE DATABASE spms_test');
    console.log('✅ Created spms_test database on port 5433');
  } catch (err) {
    console.error('❌ Error setting up test db:', err.message);
  } finally {
    await adminPool.end();
  }

  // Connect to spms_test and execute baseline.sql
  const testPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/spms_test' });
  try {
    await testPool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF; END $$;");
    await testPool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;");
    await testPool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF; END $$;");
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/baseline.sql'), 'utf8');
    await testPool.query(schemaSql);
    console.log('✅ Executed database/baseline.sql on spms_test');
  } catch (err) {
    console.error('❌ Baseline execution failed:', err.message);
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

