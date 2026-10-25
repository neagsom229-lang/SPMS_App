require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DIRECT_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 console.log('tenants:', (await p.query('select id,subdomain,status from tenants')).rows);
 console.log('store_settings:', (await p.query('select tenant_id,slug,is_open,accepts_online_orders from store_settings')).rows);
 console.log('products:', (await p.query('select status,is_published,count(*) from tbl_products group by 1,2')).rows);
 await p.end();
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
