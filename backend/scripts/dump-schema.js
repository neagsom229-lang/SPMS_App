require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 const t=await p.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1");
 for(const {table_name} of t.rows){
  const c=await p.query("select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table_name]);
  const n=await p.query('select count(*) from "'+table_name+'"');
  console.log('\n'+table_name+' ('+n.rows[0].count+' rows)');
  console.log(c.rows.map(r=>'  '+r.column_name+' '+r.data_type+(r.is_nullable==='NO'?' NOT NULL':'')).join('\n'));
 }
 await p.end();
})().catch(e=>{console.log(e.message);process.exit(1)});
