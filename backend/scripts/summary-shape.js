require('dotenv').config();
(async()=>{
 const l=await fetch('http://localhost:5000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.SEED_ADMIN_PASSWORD})});
 const {token}=await l.json();
 const r=await fetch('http://localhost:5000/api/dashboard/sales-summary?range=30d',{headers:{Authorization:'Bearer '+token}});
 const j=await r.json();
 console.log('status', r.status);
 console.log(JSON.stringify(j,null,1).slice(0,2500));
})();
