const { Pool } = require('pg');
async function test() {
  const p = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
  try {
    const res = await p.query('SELECT current_setting(\'data_directory\') as data_dir, version();');
    console.log('✅ Connected successfully!', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await p.end();
  }
}
test();
