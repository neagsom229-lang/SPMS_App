const fs = require('fs');
const { execSync } = require('child_process');

const paths = [
  'C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf'
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/scram-sha-256/g, 'trust').replace(/md5/g, 'trust');
    fs.writeFileSync(p, content, 'utf8');
    console.log('✅ Updated:', p);
  }
}

try {
  execSync('net stop postgresql-x64-16 && net start postgresql-x64-16', { stdio: 'inherit' });
} catch (e) {}

try {
  execSync('net stop postgresql-x64-17 && net start postgresql-x64-17', { stdio: 'inherit' });
} catch (e) {}
