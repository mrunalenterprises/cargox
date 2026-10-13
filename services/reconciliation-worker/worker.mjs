// LOADIN finance reconciliation worker. Trusted server/job only.
const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const hours=Math.max(1,Math.min(Number(process.env.LOADIN_RECONCILIATION_HOURS||168),744));
function readiness(){const checks={supabase:Boolean(base&&serviceKey),hours:hours>=1&&hours<=744};return {ok:Object.values(checks).every(Boolean),service:'loadin-reconciliation-worker',hours,checks}}
if(process.argv.includes('--check')){const r=readiness();console.log(JSON.stringify(r));process.exit(r.ok?0:2)}
if(!readiness().ok){console.error(JSON.stringify(readiness()));process.exit(2)}
async function rpc(name,args={}){const res=await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error||`rpc_${name}_${res.status}`);return data}
const to=new Date();const from=new Date(to.getTime()-hours*3600_000);
try{const result=await rpc('run_loadin_finance_reconciliation',{p_from:from.toISOString(),p_to:to.toISOString()});console.log(JSON.stringify({ok:true,service:'loadin-reconciliation-worker',hours,result,finishedAt:new Date().toISOString()}));if(Number(result?.p0||0)>0)process.exitCode=3}catch(error){console.error(JSON.stringify({ok:false,error:error.message,finishedAt:new Date().toISOString()}));process.exit(1)}
