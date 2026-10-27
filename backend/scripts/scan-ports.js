const { Pool } = require('pg');
async function scan() {
  for (let port = 5432; port <= 5435; port++) {
    const p = new Pool({ connectionString: `postgresql://postgres:postgres@localhost:${port}/postgres`, connectionTimeoutMillis: 1000 });
    try {
      const res = await p.query('SELECT 1');
      console.log(`✅ Port ${port} works with password 'postgres'!`);
      await p.end();
      return;
    } catch (err) {
      await p.end();
      // try without password or other pw
      const p2 = new Pool({ connectionString: `postgresql://postgres@localhost:${port}/postgres`, connectionTimeoutMillis: 1000 });
      try {
        const res2 = await p2.query('SELECT 1');
        console.log(`✅ Port ${port} works without password!`);
        await p2.end();
        return;
      } catch (err2) {
        await p2.end();
        console.log(`❌ Port ${port}: ${err.message}`);
      }
    }
  }
}
scan();
