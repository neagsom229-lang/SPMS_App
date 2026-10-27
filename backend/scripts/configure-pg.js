const fs = require('fs');
const { execSync } = require('child_process');

const hbaPath = 'C:\\program file\\PostgreSQL\\18\\data\\pg_hba.conf';
try {
  if (fs.existsSync(hbaPath)) {
    let content = fs.readFileSync(hbaPath, 'utf8');
    content = content.replace(/scram-sha-256/g, 'trust').replace(/md5/g, 'trust');
    fs.writeFileSync(hbaPath, content, 'utf8');
    console.log('✅ Updated pg_hba.conf to trust');
    execSync('net stop postgresql-x64-18 && net start postgresql-x64-18', { stdio: 'inherit' });
    console.log('✅ Restarted PostgreSQL 18 service');
  } else {
    console.error('❌ pg_hba.conf not found at', hbaPath);
  }
} catch (err) {
  console.error('❌ Error configuring PostgreSQL:', err.message);
}
