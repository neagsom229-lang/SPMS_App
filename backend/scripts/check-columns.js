// backend/scripts/check-columns.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.log('NOT VERIFIED: DATABASE_URL is not set. Run with: $env:DATABASE_URL="postgres://..."; node backend/scripts/check-columns.js');
  process.exit(0);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('neon') ? { rejectUnauthorized: false } : false,
});

async function getLiveColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    const map = {};
    for (const row of res.rows) {
      if (!map[row.table_name]) {
        map[row.table_name] = new Set();
      }
      map[row.table_name].add(row.column_name);
    }
    return map;
  } finally {
    client.release();
    await pool.end();
  }
}

function scanFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function main() {
  console.log('🔍 Fetching live database columns from information_schema...');
  let liveSchema = {};
  try {
    liveSchema = await getLiveColumns();
  } catch (err) {
    console.log('NOT VERIFIED: Could not connect to live database:', err.message);
    process.exit(0);
  }

  const srcDir = path.join(__dirname, '../src');
  const files = scanFiles(srcDir);
  
  console.log(`📁 Scanning ${files.length} backend source files for column references...`);
  
  let mismatches = 0;

  // Common known SQL keywords/aliases to filter out
  const ignored = new Set(['as', 'and', 'or', 'not', 'null', 'true', 'false', 'select', 'from', 'where', 'join', 'on', 'left', 'right', 'inner', 'outer', 'group', 'order', 'by', 'limit', 'offset', 'count', 'sum', 'coalesce', 'max', 'min', 'avg', 'now', 'jsonb', 'distinct']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      // Simple heuristic regex to catch INSERT INTO table (col1, col2, ...)
      const insertMatch = line.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const tableName = insertMatch[1].trim();
        const cols = insertMatch[2].split(',').map(c => c.trim().toLowerCase());
        if (liveSchema[tableName]) {
          cols.forEach(col => {
            if (col && !ignored.has(col) && !liveSchema[tableName].has(col)) {
              console.log(`❌ MISMATCH in ${path.relative(process.cwd(), file)}:${lineNum} -> Table '${tableName}' does not have column '${col}'`);
              mismatches++;
            }
          });
        }
      }
    });
  }

  console.log(`\n🏁 Column check completed. Total mismatches found: ${mismatches}`);
}

main().catch(err => {
  console.error('Error running check-columns:', err);
  process.exit(1);
});
