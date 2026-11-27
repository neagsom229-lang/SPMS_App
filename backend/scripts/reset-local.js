// backend/scripts/reset-local.js
//
// Destructive but narrowly scoped: drops and recreates the `public` schema
// inside the local dev database only, then re-runs migrations and the demo seed.
//
// It never drops the database, never talks to Docker, never accepts a remote
// host, and refuses to run without the typed confirmation phrase.
const path = require('path');
const readline = require('readline/promises');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { loadDevEnv } = require('./dev-env');

const { mode } = loadDevEnv();
const { assertDevDatabaseUrl, isLocal, DB_HOST, DEV_DB_NAME, DEV_DB_PORT } = require('./_guard');

const BACKEND = path.join(__dirname, '..');
const DEV_DB = path.join(__dirname, 'dev-db.js');
const PHRASE = `reset ${DEV_DB_NAME}`;

async function main() {
  if (mode !== 'local') {
    throw new Error('db:reset:local only runs with DEV_DB_MODE=local (native PostgreSQL)');
  }
  const url = process.env.DATABASE_URL;
  const identity = assertDevDatabaseUrl(url);
  if (!isLocal(url)) {
    throw new Error(`refusing to reset a non-local database (${identity.host})`);
  }
  if (identity.port !== DEV_DB_PORT || identity.database !== DEV_DB_NAME) {
    throw new Error(`refusing to reset anything except ${DB_HOST}:${DEV_DB_PORT}/${DEV_DB_NAME}`);
  }

  const client = new Client({ connectionString: url });
  client.on('error', () => {});
  await client.connect();
  try {
    const who = await client.query('SELECT current_database() AS db, current_user AS role');
    console.log(`target: ${who.rows[0].db} on ${DB_HOST}:${DEV_DB_PORT} as ${who.rows[0].role}`);
    console.log('this drops every object in the public schema of that database only.');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
      answer = await rl.question(`Type "${PHRASE}" to continue: `);
    } finally {
      rl.close();
    }
    if (answer.trim() !== PHRASE) {
      console.log('aborted: confirmation phrase did not match; nothing was dropped');
      process.exitCode = 1;
      return;
    }

    console.log('dropping and recreating schema public...');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('ALTER SCHEMA public OWNER TO CURRENT_USER');
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    await client.query('GRANT USAGE ON SCHEMA public TO PUBLIC');
  } finally {
    await client.end().catch(() => {});
  }

  const env = {
    ...process.env,
    SPMS_DB_MODE: 'local',
    DATABASE_URL: url,
  };
  delete env.ALLOW_REMOTE_DB;
  delete env.RENDER;

  execFileSync(process.execPath, [DEV_DB, 'migrate'], { cwd: BACKEND, stdio: 'inherit', env });
  execFileSync(process.execPath, [DEV_DB, 'seed'], { cwd: BACKEND, stdio: 'inherit', env });
  console.log(`db:reset:local: ${DEV_DB_NAME} rebuilt (database and role were not dropped)`);
}

main().catch(err => {
  console.error('db:reset:local failed:', err.message);
  process.exit(1);
});
