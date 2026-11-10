require('./_guard');
require('dotenv').config();
const db = require('../src/config/postgres');
(async()=>{
 const t=await db.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1");
 for(const {table_name} of t.rows){
  const c=await db.query("select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table_name]);
  const n=await db.query('select count(*) from "'+table_name+'"');
  console.log('\n'+table_name+' ('+n.rows[0].count+' rows)');
  console.log(c.rows.map(r=>'  '+r.column_name+' '+r.data_type+(r.is_nullable==='NO'?' NOT NULL':'')).join('\n'));
 }
 await db.end();
})().catch(e=>{console.log(e.message);process.exit(1)});
