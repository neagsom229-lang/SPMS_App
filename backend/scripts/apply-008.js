require('dotenv').config();
const fs=require('fs'); const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DIRECT_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 const sql=fs.readFileSync('../database/migrations/008_missing_columns.sql','utf8').replace(/^\uFEFF/,'');
 await p.query(sql);
 const r=await p.query("select table_name,column_name from information_schema.columns where table_schema='public' and ((table_name='tbl_customers' and column_name='status') or (table_name='tbl_suppliers' and column_name='status') or (table_name='tbl_products' and column_name='supplier_id') or (table_name='tbl_stock' and column_name in ('qtyreserved','minstocklevel'))) order by 1,2");
 console.log(r.rows.map(x=>x.table_name+'.'+x.column_name).join('\n'));
 await p.end();
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
