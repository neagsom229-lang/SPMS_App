require('dotenv').config();
const fs=require('fs'); const {Pool}=require('pg');
const src=fs.readFileSync(process.argv[2]||'scripts/seed.js','utf8');
const p=new Pool({connectionString:process.env.DIRECT_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 let bad=0; const re=/INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)/gi; let m;
 while((m=re.exec(src))){
  const table=m[1], cols=m[2].split(',').map(s=>s.trim()).filter(Boolean);
  const line=src.slice(0,m.index).split('\n').length;
  const r=await p.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table]);
  const have=new Set(r.rows.map(x=>x.column_name));
  const missing=cols.filter(c=>!have.has(c));
  console.log((missing.length?'MISMATCH':'ok      ')+' line '+line+' '+table+(missing.length?' -> missing: '+missing.join(', '):''));
  if(missing.length) bad++;
 }
 console.log(bad? bad+' statement(s) need fixing':'all inserts match the live schema');
 await p.end();
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
