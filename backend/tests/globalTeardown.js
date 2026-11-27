// backend/tests/globalTeardown.js
const { dropWorkerDatabases, workerCountFromConfig } = require('./test-databases');
const jestConfig = require('../jest.config');

module.exports = async () => {
  const workerCount = workerCountFromConfig(jestConfig);
  await dropWorkerDatabases(workerCount);
  console.log(`worker databases dropped: ${workerCount}`);
};
