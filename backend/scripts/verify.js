const { execSync } = require('child_process');
const fs = require('fs');
const { Client } = require('pg');

console.log('=== VERIFY PIPELINE STARTING ===');

(async () => {
  try {
    console.log('1. Starting test docker compose...');
    execSync('docker compose -f ../docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  } catch (e) {
    console.error('Docker compose up failed:', e.message);
    process.exit(1);
  }

  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres' });
  try {
    await client.connect();
    const verRes = await client.query('select version(), current_database(), inet_server_port()');
    const row = verRes.rows[0];
    console.table([row]);
    const versionStr = row.version;
    const port = row.inet_server_port;
    if (!versionStr.startsWith('PostgreSQL 17') || String(port) !== '5433') {
      console.error(`❌ FATAL: PostgreSQL version must start with PostgreSQL 17 and port must be 5433 (got version: ${versionStr}, port: ${port})`);
      process.exit(1);
    }

    await client.query('DROP DATABASE IF EXISTS spms_test WITH (FORCE)');
    await client.query('DROP DATABASE IF EXISTS spms_template WITH (FORCE)');
    await client.query('CREATE DATABASE spms_template');
    await client.end();

    const templateClient = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/spms_template' });
    await templateClient.connect();
    const baselineSql = fs.readFileSync(require('path').join(__dirname, '../../database/baseline.sql'), 'utf8');
    await templateClient.query(baselineSql);
    const mig024 = fs.readFileSync(require('path').join(__dirname, '../../database/migrations/024_backfill_tenant_plan_from_users.sql'), 'utf8');
    const mig025 = fs.readFileSync(require('path').join(__dirname, '../../database/migrations/025_revoke_default_privileges.sql'), 'utf8');
    const mig026 = fs.readFileSync(require('path').join(__dirname, '../../database/migrations/026_hardening_and_ledger.sql'), 'utf8');
    await templateClient.query(mig024);
    await templateClient.query(mig025);
    await templateClient.query(mig026);
    await templateClient.end();

    const adminClient = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres' });
    await adminClient.connect();
    await adminClient.query('CREATE DATABASE spms_test TEMPLATE spms_template');
    await adminClient.end();

    console.log('2. Running Jest test suite...');
    const jestOut = execSync('npx jest --json', { cwd: __dirname, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/spms_test' } });
    const jestData = JSON.parse(jestOut);

    const failed = jestData.numFailedTests;
    const totalTests = jestData.numTotalTests;
    const totalSuites = jestData.numTotalTestSuites;
    const passedSuites = jestData.numPassedTestSuites;

    console.log(`Test Suites: ${passedSuites} passed, ${totalSuites} total`);
    console.log(`Tests: ${jestData.numPassedTests} passed, ${totalTests} total`);

    const FLOOR_TESTS = 102;
    const FLOOR_SUITES = 15;

    if (failed > 0 || totalTests < FLOOR_TESTS || totalSuites < FLOOR_SUITES) {
      console.error(`❌ Check failed: failed=${failed} (must be 0), tests=${totalTests} (>= ${FLOOR_TESTS}), suites=${totalSuites} (>= ${FLOOR_SUITES})`);
      process.exit(1);
    }

    console.log('3. Running mutation harness...');
    try {
      execSync('powershell -ExecutionPolicy Bypass -File ./mutation.ps1', { cwd: __dirname, stdio: 'inherit' });
    } catch (mErr) {
      console.error('Mutation harness reported failure or exit non-zero');
      process.exit(1);
    }

    console.log('✅ ALL VERIFICATION CHECKS PASSED');
  } catch (err) {
    console.error('Verification error:', err.message);
    process.exit(1);
  }
})();
