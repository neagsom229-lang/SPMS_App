// backend/src/config/postgres.js
const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

// Check if we're using Neon (cloud) or local
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Neon
    require: true                // Neon requires SSL
  },
  connectionTimeoutMillis: 30000,
  family: 4,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('connect', () => {
  console.log(`✅ PostgreSQL connected successfully${isNeon ? ' (Neon Cloud)' : ' (Local)'}`);
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

const db = {
  query: async (text, params) => {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (err) {
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
      return { release: () => {} };
    }
  },
  end: async () => {
    try { await pool.end(); } catch (e) {}
  }
};

module.exports = db;