const { Pool } = require('pg');
async function t() {
  const passwords = ['postgres', 'admin', 'password', '123456', 'postgres123', 'root', 'secret', 'admin123', '', 'postgres@123'];
  for (const pw of passwords) {
    const p = new Pool({ connectionString: `postgresql://postgres:${pw}@localhost:5432/postgres` });
    try {
      const r = await p.query('SELECT 1');
      console.log('✅ SUCCESS with password:', JSON.stringify(pw));
      await p.end();
      return;
    } catch (e) {
      console.log('❌ Failed with password:', JSON.stringify(pw), '->', e.message);
      await p.end();
    }
  }
}
t();
