const { Pool } = require('pg');
async function t() {
  const passwords = ['postgres', '', 'admin', 'password', 'root', '123456'];
  for (const pw of passwords) {
    const p = new Pool({ connectionString: `postgresql://postgres:${pw}@localhost:5432/postgres` });
    try {
      await p.query('SELECT 1');
      console.log('✅ SUCCESS with password:', JSON.stringify(pw));
      process.env.DATABASE_URL = `postgresql://postgres:${pw}@localhost:5432/spms`;
      await p.end();
      return;
    } catch (e) {
      await p.end();
    }
  }
  console.log('❌ No default password worked');
}
t();
