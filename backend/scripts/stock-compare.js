require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DIRECT_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 const r=await p.query("select p.id, p.name, p.stock as products_stock, s.qtyavailable as stock_table from tbl_products p join tbl_stock s on s.productid=p.id order by (p.stock - s.qtyavailable) desc, p.id limit 5");
 console.table(r.rows);
 await p.end();
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
