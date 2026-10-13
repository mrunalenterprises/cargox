import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const mockPort=8791;
const apiPort=8792;
const origin='http://127.0.0.1:4173';
const supportId='11111111-1111-4111-8111-111111111111';
const vehicleId='22222222-2222-4222-8222-222222222222';
const driverId='33333333-3333-4333-8333-333333333333';
const assignmentId='44444444-4444-4444-8444-444444444444';

const calls=[];
const mock=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks).toString('utf8');
  calls.push({url:req.url,authorization:req.headers.authorization||'',body});
  res.writeHead(200,{'content-type':'application/json'});
  if(req.url.endsWith('/loadin_admin_dashboard_snapshot'))return res.end(JSON.stringify({role:'SUPER_ADMIN',metrics:{bookings:7}}));
  if(req.url.endsWith('/loadin_fleet_snapshot'))return res.end(JSON.stringify({account:{id:'FLEET-1'},vehicles:[]}));
  if(req.url.endsWith('/loadin_admin_resolve_support_case'))return res.end(JSON.stringify({id:supportId,status:'RESOLVED'}));
  if(req.url.endsWith('/loadin_admin_set_city_service_status'))return res.end(JSON.stringify({city_code:'CSN',service_code:'PARCEL_2W',status:'PAUSED'}));
  if(req.url.endsWith('/loadin_admin_city_service_config_snapshot'))return res.end(JSON.stringify({city:{code:'CSN',name:'Chhatrapati Sambhaji Nagar'},services:[{code:'PARCEL_2W',status:'ACTIVE',base_fare:35,extra_km_rate:8,commission_pct:15}]}));
  if(req.url.endsWith('/loadin_admin_set_city_pricing'))return res.end(JSON.stringify({city_code:'CSN',service_code:'PARCEL_2W',base_fare:40,extra_km_rate:9,commission_pct:15}));
  if(req.url.endsWith('/loadin_fleet_add_vehicle'))return res.end(JSON.stringify({id:vehicleId,registration_number:'MH20AB1234',vehicle_type:'TATA_ACE',status:'ACTIVE'}));
  if(req.url.endsWith('/loadin_fleet_add_driver'))return res.end(JSON.stringify({id:driverId,name:'CI Driver',phone:'+919900001234',status:'ACTIVE'}));
  if(req.url.endsWith('/loadin_fleet_assign_driver'))return res.end(JSON.stringify({id:assignmentId,vehicle_id:vehicleId,driver_id:driverId,status:'ACTIVE'}));
  if(req.url.endsWith('/loadin_fleet_end_assignment'))return res.end(JSON.stringify({id:assignmentId,status:'ENDED'}));
  if(req.url.endsWith('/loadin_fleet_set_vehicle_status'))return res.end(JSON.stringify({id:vehicleId,status:'MAINTENANCE'}));
  if(req.url.endsWith('/loadin_fleet_set_driver_status'))return res.end(JSON.stringify({id:driverId,status:'INACTIVE'}));
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
const auth=(token='fleet-token')=>({Origin:origin,Authorization:`Bearer ${token}`,'content-type':'application/json'});

try{
  await waitReady();
  let r=await call('/ready');assert.equal(r.status,200);let j=await r.json();assert.equal(j.ok,true);assert.equal(j.strictBrowserOrigins,true);
  r=await call('/dashboard',{headers:{Origin:origin}});assert.equal(r.status,401);
  r=await call('/dashboard',{headers:{Origin:'https://evil.example',Authorization:'Bearer user-token'}});assert.equal(r.status,403);
  r=await call('/dashboard',{headers:{Origin:origin,Authorization:'Bearer user-token'}});assert.equal(r.status,200);j=await r.json();assert.equal(j.metrics.bookings,7);assert.equal(calls.at(-1).authorization,'Bearer user-token');
  r=await call('/fleet/me',{headers:{Origin:origin,Authorization:'Bearer fleet-token'}});assert.equal(r.status,200);j=await r.json();assert.equal(j.account.id,'FLEET-1');

  r=await call(`/admin/support/${supportId}/resolve`,{method:'POST',headers:auth('admin-token'),body:JSON.stringify({notes:'Customer contacted and issue resolved.'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'RESOLVED');
  const supportCall=calls.at(-1);assert.match(supportCall.url,/loadin_admin_resolve_support_case$/);assert.equal(JSON.parse(supportCall.body).p_case_id,supportId);

  r=await call('/admin/city-service-config?cityCode=csn',{headers:auth('admin-token')});assert.equal(r.status,200);j=await r.json();assert.equal(j.city.code,'CSN');let rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');
  r=await call('/admin/city-service-status',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'csn',serviceCode:'parcel_2w',status:'paused',reason:'Capacity control'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'PAUSED');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');assert.equal(rpc.p_service_code,'PARCEL_2W');
  r=await call('/admin/city-pricing',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'csn',serviceCode:'parcel_2w',baseFare:40,extraKmRate:9,reason:'Quarterly review'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.base_fare,40);rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_base_fare,40);assert.equal(rpc.p_extra_km_rate,9);

  r=await call('/fleet/vehicles',{method:'POST',headers:auth(),body:JSON.stringify({registrationNumber:'mh20ab1234',vehicleType:'TATA_ACE'})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,vehicleId);rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_registration_number,'mh20ab1234');
  r=await call('/fleet/drivers',{method:'POST',headers:auth(),body:JSON.stringify({fullName:'CI Driver',mobile:'+919900001234'})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,driverId);
  r=await call('/fleet/assignments',{method:'POST',headers:auth(),body:JSON.stringify({vehicleId,driverId})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,assignmentId);
  r=await call(`/fleet/assignments/${assignmentId}/end`,{method:'POST',headers:auth(),body:'{}'});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'ENDED');
  r=await call(`/fleet/vehicles/${vehicleId}/status`,{method:'POST',headers:auth(),body:JSON.stringify({status:'maintenance'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'MAINTENANCE');
  r=await call(`/fleet/drivers/${driverId}/status`,{method:'POST',headers:auth(),body:JSON.stringify({status:'inactive'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'INACTIVE');

  r=await call('/admin/city-pricing',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'CSN',serviceCode:'PARCEL_2W',baseFare:-1,extraKmRate:9})});assert.equal(r.status,400);
  r=await call('/fleet/assignments',{method:'POST',headers:auth(),body:JSON.stringify({vehicleId:'bad',driverId})});assert.equal(r.status,400);
  r=await call('/fleet/vehicles/not-a-uuid/status',{method:'POST',headers:auth(),body:JSON.stringify({status:'ACTIVE'})});assert.equal(r.status,400);
  r=await call('/fleet/vehicles',{method:'POST',headers:auth(),body:JSON.stringify({vehicleType:'TATA_ACE'})});assert.equal(r.status,400);
  r=await call('/admin/city-service-status',{method:'POST',headers:auth('admin-token'),body:'{"cityCode":'});assert.equal(r.status,400);
  r=await call('/admin/city-service-status',{method:'POST',headers:auth('admin-token'),body:'x'.repeat(3000)});assert.equal(r.status,413);
  r=await call('/admin/support/not-a-uuid/resolve',{method:'POST',headers:auth('admin-token'),body:'{}'});assert.equal(r.status,400);
  r=await call('/unknown',{headers:{Origin:origin,Authorization:'Bearer admin-token'}});assert.equal(r.status,404);
  console.log('Portal API contract tests passed.');
} finally {child.kill('SIGTERM');await new Promise(r=>setTimeout(r,80));mock.close()}
