// backend/scripts/verify-db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.log('NOT VERIFIED: DATABASE_URL is not set. Run with: $env:DATABASE_URL="postgres://..."; node backend/scripts/verify-db.js');
  process.exit(0);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('neon') ? { rejectUnauthorized: false } : false,
});

async function verify() {
  const client = await pool.connect();
  try {
    const tables = ['tenants', 'tbl_users', 'store_settings', 'tbl_categories', 'tbl_products', 'tbl_stock', 'tbl_customers'];
    console.log('🔍 Verifying LIVE database schema columns...');

    for (const tbl of tables) {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tbl]);

      console.log(`\n📋 Table: ${tbl} (${res.rowCount} columns)`);
      res.rows.forEach(r => {
        console.log(`   - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
      });
    }
  } catch (err) {
    console.error('❌ Verify DB error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(err => {
  console.error('Fatal error in verify-db:', err);
  process.exit(1);
});
