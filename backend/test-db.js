// test-db.js
require('dotenv').config();
// ✅ CORRECT PATH - config is in src/config/
const db = require('./src/config/postgres');

async function testConnection() {
  console.log('🔍 Testing PostgreSQL connection...');
  console.log('📡 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in .env file');
    process.exit(1);
  }
  
  try {
    const result = await db.query('SELECT NOW() as time, current_database() as db, version() as version');
    console.log('✅ Connected successfully!');
    console.log('📊 Database:', result.rows[0].db);
    console.log('🕐 Time:', result.rows[0].time);
    console.log('📦 Version:', result.rows[0].version);
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('❌ Full error:', err);
    process.exit(1);
  }
}

testConnection();