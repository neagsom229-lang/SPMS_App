// backend/scripts/backup.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const date = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `backup_${date}.sql`;
const filepath = path.join(backupDir, filename);

const command = `pg_dump ${process.env.DATABASE_URL} > "${filepath}"`;

console.log('🔄 Starting database backup...');

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
  
  const stats = fs.statSync(filepath);
  console.log(`✅ Backup successful! (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`📁 Saved to: ${filepath}`);
  
  // Keep only last 7 backups
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();
  
  if (files.length > 7) {
    const toDelete = files.slice(7);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(backupDir, f));
      console.log(`🗑️ Deleted old backup: ${f}`);
    });
  }
  
  process.exit(0);
});