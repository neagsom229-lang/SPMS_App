require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DIRECT_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 for (const t of ['tenants','store_settings','tbl_users','tbl_categories','tbl_products','tbl_stock','tbl_customers','tbl_orders','tbl_order_items']) {
  const r=await p.query('select count(*) from '+t); console.log(t, r.rows[0].count);
 }
 await p.end();
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
