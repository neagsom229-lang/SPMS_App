// backend/scripts/migrate-plaintext-passwords.js
require('dotenv').config();
const pool = require('../src/config/postgres');
const bcrypt = require('bcryptjs');

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT userid, password FROM tbl_users');
    let migratedCount = 0;
    for (const user of res.rows) {
      if (user.password && !user.password.startsWith('$2')) {
        const hashed = await bcrypt.hash(user.password, 10);
        await client.query('UPDATE tbl_users SET password = $1 WHERE userid = $2', [hashed, user.userid]);
        migratedCount++;
      }
    }
    console.log(`[Migration] Successfully hashed plaintext passwords for ${migratedCount} accounts.`);
  } catch (err) {
    console.error('[Migration] Error migrating plaintext passwords:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
