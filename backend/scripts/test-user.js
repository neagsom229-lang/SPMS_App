const { Pool } = require('pg');
async function test() {
  const connectionStrings = [
    'postgresql://chhea@localhost:5432/postgres',
    'postgresql://localhost:5432/postgres',
    'postgresql://postgres@localhost:5432/postgres',
  ];
  for (const cs of connectionStrings) {
    const p = new Pool({ connectionString: cs });
    try {
      const res = await p.query('SELECT current_user, current_database()');
      console.log('✅ Connected with:', cs, res.rows[0]);
      await p.end();
      return;
    } catch (err) {
      console.log('❌ Failed with:', cs, '->', err.message);
      await p.end();
    }
  }
}
test();
