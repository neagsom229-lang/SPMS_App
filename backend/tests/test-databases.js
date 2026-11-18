// backend/tests/test-databases.js
// One database per jest worker, cloned from the fully-migrated template.
// Every generated name still ends in _test so it passes scripts/_guard.js.
const { Client } = require('pg');
const { testDatabaseUrl, assertTestDatabaseUrl } = require('../scripts/_guard');

const TEMPLATE_DB = 'spms_test';
const WORKER_DB_PREFIX = 'spms_test_w';

function workerDatabaseName(workerId) {
  const name = `${WORKER_DB_PREFIX}${workerId}_test`;
  assertTestDatabaseUrl(testDatabaseUrl(name));
  return name;
}

function workerCountFromConfig(config) {
  if (process.argv.includes('--runInBand') || process.argv.includes('-i')) return 1;
  const n = Number(config && config.maxWorkers);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

async function withAdmin(fn) {
  const client = new Client({ connectionString: testDatabaseUrl('postgres') });
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createWorkerDatabases(count) {
  for (let workerId = 1; workerId <= count; workerId++) {
    const name = workerDatabaseName(workerId);
    await withAdmin(async admin => {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DB}"`);
    });
  }
}

async function dropWorkerDatabases(count) {
  for (let workerId = 1; workerId <= count; workerId++) {
    const name = workerDatabaseName(workerId);
    await withAdmin(async admin => {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    });
  }
}

module.exports = {
  TEMPLATE_DB,
  workerDatabaseName,
  workerCountFromConfig,
  createWorkerDatabases,
  dropWorkerDatabases,
};
