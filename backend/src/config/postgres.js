// backend/src/config/postgres.js
const { Pool, types } = require('pg');
const dns = require('dns');
require('dotenv').config();

types.setTypeParser(1114, v => new Date(v.replace(' ', 'T') + 'Z'));

// Force IPv4 lookup for Windows/Node compatibility
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignored if unsupported in certain node environments
}



const isProd = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL || (isProd ? null : 'postgresql://postgres:postgres@localhost:5432/spms');

if (!connectionString) {
  console.error('❌ DATABASE_URL is required in production');
  process.exit(1);
}

let dbHost = 'localhost';
try {
  const parsedUrl = new URL(connectionString);
  dbHost = parsedUrl.hostname;
} catch (e) {
  // Fallback if not a standard URL
}

const isSupabase = dbHost.includes('supabase.com') || dbHost.includes('supabase.co');
const isNeon = dbHost.includes('neon.tech') || process.env.DB_SSL === 'true' || isProd;
const isCloud = isSupabase || isNeon;


const pool = new Pool({
  connectionString,
  ssl: isCloud ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

const isReadOnlyQuery = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith('select');
};

const isConnectionResetError = (err) => {
  const msg = err.message || '';
  return msg.includes('ECONNRESET') || msg.includes('Connection terminated') || msg.includes('terminated unexpectedly');
};

const db = {
  query: async (text, params) => {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (err) {
      if (isReadOnlyQuery(text) && isConnectionResetError(err)) {
        console.warn('⚠️ Read-only query encountered connection reset, retrying once:', err.message);
        try {
          return await pool.query(text, params);
        } catch (retryErr) {
          console.error('❌ Retry query error:', retryErr.message);
          throw retryErr;
        }
      }
      console.error('❌ Query error:', err.message);
      console.error('❌ Query text:', text);
      throw err;
    }
  },
  connect: async () => {
    try {
      return await pool.connect();
    } catch (err) {
      console.error('❌ Connection error:', err.message);
      throw err;
    }
  },
  end: async () => {
    try { await pool.end(); } catch (e) {}
  }
};

module.exports = db;
