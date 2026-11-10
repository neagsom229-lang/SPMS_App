const { execSync } = require('child_process');
const { Client } = require('pg');
const { TEST_DB_PORT, testDatabaseUrl } = require('./_guard.js');

console.log('=== VERIFY PIPELINE STARTING ===');

(async () => {
  try {
    console.log('1. Starting test docker compose...');
    execSync('docker compose -f ../docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  } catch (e) {
    console.error('Docker compose up failed:', e.message);
    process.exit(1);
  }

  const client = new Client({ connectionString: testDatabaseUrl('postgres') });
  try {
    await client.connect();
    const verRes = await client.query('select version(), current_database(), inet_server_port()');
    const row = verRes.rows[0];
    console.table([row]);
    if (!row.version.startsWith('PostgreSQL 17')) {
      console.error(`❌ FATAL: PostgreSQL version must start with PostgreSQL 17 (got version: ${row.version}, expected port: ${TEST_DB_PORT})`);
      process.exit(1);
    }
    if (String(row.inet_server_port) !== String(TEST_DB_PORT)) {
      console.error(`❌ FATAL: connected to port ${row.inet_server_port}, expected ${TEST_DB_PORT}`);
      process.exit(1);
    }
    await client.end();
  } catch (err) {
    console.error('Verification error:', err.message);
    process.exit(1);
  }

  // globalSetup loads baseline.sql (state after 014), marks only 001-014, runs
  // 015-026 through the real runner and performs the production replay check.
  console.log('2. Running Jest test suite (globalSetup builds the DB)...');
  let jestData;
  try {
    const jestOut = execSync('npx jest --json', {
      cwd: __dirname,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    });
    jestData = JSON.parse(jestOut);
  } catch (err) {
    console.error('Jest failed:', err.message);
    process.exit(1);
  }

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
})().catch(err => {
  console.error('Verification error:', err.message);
  process.exit(1);
});
