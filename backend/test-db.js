require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:761SiW4njgzrV0GV@db.kimpbipjxnoeyvaabrqr.supabase.co:5432/postgres';

async function testConnection() {
  console.log('🔍 Testing PostgreSQL connection with:', connectionString.replace(/:[^:@]+@/, ':****@'));
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time, current_database() as db, version() as version');
    console.log('✅ Connected successfully!');
    console.log('📊 Database:', result.rows[0].db);
    console.log('🕐 Time:', result.rows[0].time);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
