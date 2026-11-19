// backend/scripts/dev-env.js
//
// One place that decides which local dev database `npm run dev` talks to.
//
//   DEV_DB_MODE=local   native PostgreSQL on 127.0.0.1:${DEV_DB_PORT} (5432),
//                       database spms_db, credentials from backend/.env
//   DEV_DB_MODE=docker  legacy disposable container on 127.0.0.1:15433
//
// The file is parsed instead of letting dotenv merge it, because a remote
// DATABASE_URL exported in the shell must never win over the loopback URL in
// backend/.env. Values are never printed by this module.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATH = path.join(__dirname, '..', '.env');

function loadDevEnv() {
  const hasEnvFile = fs.existsSync(ENV_PATH);
  const file = hasEnvFile ? dotenv.parse(fs.readFileSync(ENV_PATH)) : {};
  const requested = String(file.DEV_DB_MODE || process.env.DEV_DB_MODE || 'docker').toLowerCase();
  const mode = requested === 'local' ? 'local' : 'docker';

  // Load every key the shell did not already provide. This keeps JWT_SECRET,
  // Bakong settings and the rest available without printing anything.
  for (const [key, value] of Object.entries(file)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  process.env.DEV_DB_MODE = mode;
  process.env.SPMS_DB_MODE = mode === 'local' ? 'local' : 'dev';

  if (mode === 'local') {
    if (!file.DATABASE_URL) {
      throw new Error('DEV_DB_MODE=local requires DATABASE_URL in backend/.env');
    }
    process.env.DATABASE_URL = file.DATABASE_URL;
    process.env.DEV_DB_PORT = String(file.DEV_DB_PORT || process.env.DEV_DB_PORT || 5432);
    process.env.DEV_DB_NAME = file.DEV_DB_NAME || process.env.DEV_DB_NAME || 'spms_db';
  }

  return { mode, hasEnvFile, envPath: ENV_PATH };
}

module.exports = { loadDevEnv, ENV_PATH };
