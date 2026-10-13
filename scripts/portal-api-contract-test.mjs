import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const mockPort=8791;
const apiPort=8792;
const origin='http://127.0.0.1:4173';
const supportId='11111111-1111-4111-8111-111111111111';

const calls=[];
const mock=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks).toString('utf8');
  calls.push({url:req.url,authorization:req.headers.authorization||'',body});
  res.writeHead(200,{'content-type':'application/json'});
  if(req.url.endsWith('/loadin_admin_dashboard_snapshot'))return res.end(JSON.stringify({role:'SUPER_ADMIN',metrics:{bookings:7}}));
  if(req.url.endsWith('/loadin_fleet_snapshot'))return res.end(JSON.stringify({account:{id:'FLEET-1'},vehicles:[]}));
  if(req.url.endsWith('/loadin_admin_resolve_support_case'))return res.end(JSON.stringify({id:supportId,status:'RESOLVED'}));
  if(req.url.endsWith('/loadin_admin_set_city_service_status'))return res.end(JSON.stringify({city_code:'CSN',service_code:'TWO_WHEELER_PARCEL',status:'PAUSED'}));
  res.end('{}');
});
await new Promise(resolve=>mock.listen(mockPort,'127.0.0.1',resolve));

const child=spawn(process.execPath,['services/portal-api/worker.mjs'],{
  env:{...process.env,PORT:String(apiPort),SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'anon-test',LOADIN_ALLOWED_ORIGINS:origin,LOADIN_REQUIRE_BROWSER_ORIGINS:'true',LOADIN_PORTAL_MAX_BODY_BYTES:'2048'},
  stdio:['ignore','pipe','pipe']
});
let stderr='';child.stderr.on('data',d=>stderr+=d);

async function waitReady(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${apiPort}/health`);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error(`portal_worker_not_ready ${stderr}`)}
async function call(path,options={}){return fetch(`http://127.0.0.1:${apiPort}${path}`,options)}

try{
  await waitReady();
  let r=await call('/ready');assert.equal(r.status,200);let j=await r.json();assert.equal(j.ok,true);assert.equal(j.strictBrowserOrigins,true);

  r=await call('/dashboard',{headers:{Origin:origin}});assert.equal(r.status,401);
  r=await call('/dashboard',{headers:{Origin:'https://evil.example',Authorization:'Bearer user-token'}});assert.equal(r.status,403);
  r=await call('/dashboard',{headers:{Origin:origin,Authorization:'Bearer user-token'}});assert.equal(r.status,200);j=await r.json();assert.equal(j.metrics.bookings,7);
  assert.equal(calls.at(-1).authorization,'Bearer user-token');

  r=await call('/fleet/me',{headers:{Origin:origin,Authorization:'Bearer fleet-token'}});assert.equal(r.status,200);j=await r.json();assert.equal(j.account.id,'FLEET-1');

  r=await call(`/admin/support/${supportId}/resolve`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer admin-token','content-type':'application/json'},body:JSON.stringify({notes:'Customer contacted and issue resolved.'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'RESOLVED');
  const supportCall=calls.at(-1);assert.match(supportCall.url,/loadin_admin_resolve_support_case$/);assert.equal(JSON.parse(supportCall.body).p_case_id,supportId);

  r=await call('/admin/city-service-status',{method:'POST',headers:{Origin:origin,Authorization:'Bearer admin-token','content-type':'application/json'},body:JSON.stringify({cityCode:'csn',serviceCode:'two_wheeler_parcel',status:'paused',reason:'Capacity control'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'PAUSED');
  const cityCall=JSON.parse(calls.at(-1).body);assert.equal(cityCall.p_city_code,'CSN');assert.equal(cityCall.p_service_code,'TWO_WHEELER_PARCEL');

  r=await call('/admin/city-service-status',{method:'POST',headers:{Origin:origin,Authorization:'Bearer admin-token','content-type':'application/json'},body:'{"cityCode":'});assert.equal(r.status,400);
  r=await call('/admin/city-service-status',{method:'POST',headers:{Origin:origin,Authorization:'Bearer admin-token','content-type':'application/json'},body:'x'.repeat(3000)});assert.equal(r.status,413);
  r=await call('/admin/support/not-a-uuid/resolve',{method:'POST',headers:{Origin:origin,Authorization:'Bearer admin-token','content-type':'application/json'},body:'{}'});assert.equal(r.status,400);
  r=await call('/unknown',{headers:{Origin:origin,Authorization:'Bearer admin-token'}});assert.equal(r.status,404);

  console.log('Portal API contract tests passed.');
} finally {
  child.kill('SIGTERM');
  await new Promise(r=>setTimeout(r,80));
  mock.close();
}
