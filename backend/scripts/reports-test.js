require('dotenv').config();
const base='http://localhost:5000';
(async()=>{
 const noAuth=await fetch(base+'/api/reports/export/products');
 console.log('no token ->', noAuth.status, '(expect 401)');
 const l=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.SEED_ADMIN_PASSWORD})});
 const {token}=await l.json();
 for (const t of ['products','orders','customers','stock','nonsense']) {
  const r=await fetch(base+'/api/reports/export/'+t,{headers:{Authorization:'Bearer '+token}});
  const b=Buffer.from(await r.arrayBuffer());
  console.log(t.padEnd(10), r.status, b.length+' bytes', b.slice(0,2).toString()==='PK'?'(valid xlsx)':'');
 }
})();
