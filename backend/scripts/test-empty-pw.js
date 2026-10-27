const { Pool } = require('pg');
async function test() {
  const p = new Pool({ connectionString: 'postgresql://postgres:@localhost:5432/postgres' });
  try {
    const res = await p.query('SELECT current_user, current_database()');
    console.log('✅ Connected!', res.rows[0]);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await p.end();
  }
}
test();
