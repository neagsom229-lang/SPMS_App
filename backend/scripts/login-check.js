require('dotenv').config();
const bcrypt=require('bcryptjs'); const {Pool}=require('pg');
(async()=>{
 const srv=await fetch('http://localhost:5000/health').then(r=>r.status).catch(()=>'server not running');
 console.log('server health:', srv);
 const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
 const r=await p.query("select username, password, status, is_super_admin, tenant_id from tbl_users where username='admin'");
 await p.end();
 if(!r.rows.length){console.log('no admin user found'); return;}
 const u=r.rows[0];
 console.log('admin row: status='+u.status+' tenant_id='+u.tenant_id+' super='+u.is_super_admin);
 console.log('SEED_ADMIN_PASSWORD matches stored hash:', await bcrypt.compare(process.env.SEED_ADMIN_PASSWORD||'', u.password));
 const l=await fetch('http://localhost:5000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.SEED_ADMIN_PASSWORD})});
 const j=await l.json().catch(()=>({}));
 console.log('login status:', l.status, '| response keys:', Object.keys(j).join(',')||'(none)', '| error:', j.error||'-');
})().catch(e=>{console.log('FAILED:',e.message);process.exit(1)});
