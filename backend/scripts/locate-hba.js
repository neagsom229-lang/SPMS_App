const fs = require('fs');
const path = require('path');

const baseDirs = [
  'C:/Program Files/PostgreSQL',
  'C:/program file/PostgreSQL',
  'C:/ProgramFiles/PostgreSQL'
];

for (const base of baseDirs) {
  if (fs.existsSync(base)) {
    const versions = fs.readdirSync(base);
    for (const v of versions) {
      const dataPath = path.join(base, v, 'data', 'pg_hba.conf');
      if (fs.existsSync(dataPath)) {
        console.log('✅ Found pg_hba.conf at:', dataPath);
      }
    }
  }
}
