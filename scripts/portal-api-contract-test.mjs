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
const staffId='55555555-5555-4555-8555-555555555555';
const issueId='66666666-6666-4666-8666-666666666666';
const releaseId='77777777-7777-4777-8777-777777777777';

const calls=[];
const mock=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks).toString('utf8');
  calls.push({url:req.url,authorization:req.headers.authorization||'',body});
  res.writeHead(200,{'content-type':'application/json'});
  if(req.url.endsWith('/loadin_admin_dashboard_snapshot'))return res.end(JSON.stringify({role:'SUPER_ADMIN',metrics:{bookings:7}}));
  if(req.url.endsWith('/loadin_fleet_snapshot'))return res.end(JSON.stringify({account:{id:'FLEET-1'},vehicles:[]}));
  if(req.url.endsWith('/loadin_admin_staff_snapshot'))return res.end(JSON.stringify({role:'SUPER_ADMIN',staff:[{user_id:staffId,role:'FIELD_OFFICER'}],audit:[]}));
  if(req.url.endsWith('/loadin_admin_upsert_staff'))return res.end(JSON.stringify({user_id:staffId,role:'FIELD_OFFICER',city_code:'CSN',is_active:true}));
  if(req.url.endsWith('/loadin_admin_finance_reconciliation_snapshot'))return res.end(JSON.stringify({role:'ACCOUNTS',latestRun:{status:'COMPLETED'},issues:[{id:issueId,status:'OPEN'}]}));
  if(req.url.endsWith('/loadin_admin_run_finance_reconciliation'))return res.end(JSON.stringify({status:'COMPLETED',openIssues:1,p0:0,p1:1}));
  if(req.url.endsWith('/loadin_admin_resolve_reconciliation_issue'))return res.end(JSON.stringify({id:issueId,status:'RESOLVED'}));
  if(req.url.endsWith('/loadin_admin_launch_gate_snapshot'))return res.end(JSON.stringify({releaseReady:false,role:'SUPER_ADMIN',city:{code:'CSN'},checks:[{key:'CITY_ENABLED',status:'PASS'}],manualChecks:[{key:'OTP_REAL_DEVICE',status:'PENDING'}],signoffs:[]}));
  if(req.url.endsWith('/loadin_admin_set_launch_check'))return res.end(JSON.stringify({key:'OTP_REAL_DEVICE',status:'PASS'}));
  if(req.url.endsWith('/loadin_admin_create_release_signoff'))return res.end(JSON.stringify({id:releaseId,status:'DRAFT',releaseLabel:'LOADIN 1.0 RC1',cityCode:'CSN'}));
  if(req.url.endsWith('/loadin_admin_approve_release_signoff'))return res.end(JSON.stringify({id:releaseId,status:'APPROVED'}));
  if(req.url.endsWith('/loadin_admin_revoke_release_signoff'))return res.end(JSON.stringify({id:releaseId,status:'REVOKED'}));
  if(req.url.endsWith('/loadin_admin_resolve_support_case'))return res.end(JSON.stringify({id:supportId,status:'RESOLVED'}));
  if(req.url.endsWith('/loadin_admin_set_city_service_status'))return res.end(JSON.stringify({city_code:'CSN',service_code:'PARCEL_2W',status:'PAUSED'}));
  if(req.url.endsWith('/loadin_admin_city_service_config_snapshot'))return res.end(JSON.stringify({city:{code:'CSN',name:'CI City'},services:[{code:'PARCEL_2W',status:'ACTIVE',base_fare:35,extra_km_rate:8,commission_pct:15}]}));
  if(req.url.endsWith('/loadin_admin_set_city_pricing'))return res.end(JSON.stringify({city_code:'CSN',service_code:'PARCEL_2W',base_fare:40,extra_km_rate:9,commission_pct:15}));
  if(req.url.endsWith('/loadin_fleet_add_vehicle'))return res.end(JSON.stringify({id:vehicleId,registration_number:'MH20AB1234',vehicle_type:'TATA_ACE',status:'ACTIVE'}));
  if(req.url.endsWith('/loadin_fleet_add_driver'))return res.end(JSON.stringify({id:driverId,name:'CI Driver',status:'ACTIVE'}));
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

  r=await call('/admin/staff',{headers:auth('admin-token')});assert.equal(r.status,200);j=await r.json();assert.equal(j.staff[0].user_id,staffId);
  r=await call('/admin/staff',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({userId:staffId,role:'field_officer',cityCode:'csn',displayName:'CI FO',isActive:true,reason:'Appointment'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.role,'FIELD_OFFICER');let rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');assert.equal(rpc.p_role,'FIELD_OFFICER');

  r=await call('/admin/reconciliation',{headers:auth('accounts-token')});assert.equal(r.status,200);j=await r.json();assert.equal(j.issues[0].id,issueId);
  r=await call('/admin/reconciliation/run',{method:'POST',headers:auth('accounts-token'),body:JSON.stringify({hours:168})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'COMPLETED');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_hours,168);
  r=await call(`/admin/reconciliation/${issueId}/resolve`,{method:'POST',headers:auth('accounts-token'),body:JSON.stringify({status:'resolved',notes:'Matched bank ledger'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'RESOLVED');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_issue_id,issueId);assert.equal(rpc.p_status,'RESOLVED');

  r=await call('/admin/launch-gate?cityCode=csn',{headers:auth('admin-token')});assert.equal(r.status,200);j=await r.json();assert.equal(j.city.code,'CSN');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');
  r=await call('/admin/launch-check',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({key:'otp_real_device',status:'pass',evidence:'Physical device verified'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'PASS');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_check_key,'OTP_REAL_DEVICE');assert.equal(rpc.p_status,'PASS');
  r=await call('/admin/release-signoff',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({releaseLabel:'LOADIN 1.0 RC1',commitSha:'abcdef1234567',cityCode:'csn',notes:'CI release'})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,releaseId);rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');
  r=await call(`/admin/release-signoff/${releaseId}/approve`,{method:'POST',headers:auth('admin-token'),body:JSON.stringify({notes:'Approved'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'APPROVED');
  r=await call(`/admin/release-signoff/${releaseId}/revoke`,{method:'POST',headers:auth('admin-token'),body:JSON.stringify({notes:'Rollback'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'REVOKED');

  r=await call(`/admin/support/${supportId}/resolve`,{method:'POST',headers:auth('admin-token'),body:JSON.stringify({notes:'Resolved.'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'RESOLVED');
  r=await call('/admin/city-service-config?cityCode=csn',{headers:auth('admin-token')});assert.equal(r.status,200);j=await r.json();assert.equal(j.city.code,'CSN');rpc=JSON.parse(calls.at(-1).body);assert.equal(rpc.p_city_code,'CSN');
  r=await call('/admin/city-service-status',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'csn',serviceCode:'parcel_2w',status:'paused',reason:'Capacity control'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.status,'PAUSED');
  r=await call('/admin/city-pricing',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'csn',serviceCode:'parcel_2w',baseFare:40,extraKmRate:9,reason:'Review'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.base_fare,40);

  r=await call('/fleet/vehicles',{method:'POST',headers:auth(),body:JSON.stringify({registrationNumber:'mh20ab1234',vehicleType:'TATA_ACE'})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,vehicleId);
  r=await call('/fleet/drivers',{method:'POST',headers:auth(),body:JSON.stringify({fullName:'CI Driver'})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,driverId);
  r=await call('/fleet/assignments',{method:'POST',headers:auth(),body:JSON.stringify({vehicleId,driverId})});assert.equal(r.status,201);j=await r.json();assert.equal(j.id,assignmentId);
  r=await call(`/fleet/assignments/${assignmentId}/end`,{method:'POST',headers:auth(),body:'{}'});assert.equal(r.status,200);
  r=await call(`/fleet/vehicles/${vehicleId}/status`,{method:'POST',headers:auth(),body:JSON.stringify({status:'maintenance'})});assert.equal(r.status,200);
  r=await call(`/fleet/drivers/${driverId}/status`,{method:'POST',headers:auth(),body:JSON.stringify({status:'inactive'})});assert.equal(r.status,200);

  r=await call('/admin/staff',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({userId:'bad',role:'GM',cityCode:'CSN'})});assert.equal(r.status,400);
  r=await call('/admin/reconciliation/run',{method:'POST',headers:auth('accounts-token'),body:JSON.stringify({hours:999})});assert.equal(r.status,400);
  r=await call('/admin/reconciliation/not-a-uuid/resolve',{method:'POST',headers:auth('accounts-token'),body:'{}'});assert.equal(r.status,400);
  r=await call('/admin/launch-check',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({key:'OTP_REAL_DEVICE',status:'BAD'})});assert.equal(r.status,400);
  r=await call('/admin/release-signoff/not-a-uuid/approve',{method:'POST',headers:auth('admin-token'),body:'{}'});assert.equal(r.status,400);
  r=await call('/admin/city-pricing',{method:'POST',headers:auth('admin-token'),body:JSON.stringify({cityCode:'CSN',serviceCode:'PARCEL_2W',baseFare:-1,extraKmRate:9})});assert.equal(r.status,400);
  r=await call('/fleet/assignments',{method:'POST',headers:auth(),body:JSON.stringify({vehicleId:'bad',driverId})});assert.equal(r.status,400);
  r=await call('/admin/city-service-status',{method:'POST',headers:auth('admin-token'),body:'x'.repeat(3000)});assert.equal(r.status,413);
  r=await call('/unknown',{headers:{Origin:origin,Authorization:'Bearer admin-token'}});assert.equal(r.status,404);
  console.log('Portal API contract tests passed.');
} finally {child.kill('SIGTERM');await new Promise(r=>setTimeout(r,80));mock.close()}
