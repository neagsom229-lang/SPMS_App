// backend/src/config/postgres.js
const { Pool, types } = require('pg');
const dns = require('dns');
const path = require('path');

if (process.env.NODE_ENV === 'test') {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });
  } catch (e) {}
} else {
  // Never read backend/.env
}

types.setTypeParser(1114, v => new Date(v.replace(' ', 'T') + 'Z'));

// Force IPv4 lookup for Windows/Node compatibility
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignored if unsupported in certain node environments
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is required (not set in environment or .env.test)');
  process.exit(1);
}

let dbHost = null;
let isLocalHost = false;
try {
  const parsedUrl = new URL(connectionString);
  dbHost = parsedUrl.hostname;
  if (dbHost) {
    const cleanHost = dbHost.replace(/^\[|\]$/g, '');
    isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(cleanHost) || dbHost === '[::1]';
  }
} catch (e) {
  dbHost = null;
  isLocalHost = false;
}

const isRender = process.env.RENDER === 'true';
const allowRemote = process.env.ALLOW_REMOTE_DB === '1';

if (!isLocalHost && !isRender && !allowRemote) {
  const msg = `❌ REFUSING TO CONNECT: DATABASE_URL host must be localhost, 127.0.0.1, or ::1 (current host: ${dbHost}). Set ALLOW_REMOTE_DB=1 or RENDER=true to bypass.`;
  console.error(msg);
  if (process.env.NODE_ENV === 'test') {
    throw new Error(msg);
  }
  process.exit(1);
}

const isSupabase = dbHost ? (dbHost.includes('supabase.com') || dbHost.includes('supabase.co')) : false;
const isNeon = dbHost ? (dbHost.includes('neon.tech') || process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') : false;
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
