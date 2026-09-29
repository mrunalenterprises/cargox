import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { generateKeyPair,SignJWT,jwtVerify } from 'jose';
import { createStagingServer } from '../src/server.mjs';
import {database,id,claims} from '../support/database.mjs';
let h,server,base,keys,authRequests=0;
const issuer='urn:cargox:isolated-auth-test';
const sign=async(n,extra={},key=keys.privateKey)=>new SignJWT(claims(n,extra)).setProtectedHeader({alg:'ES256'})
 .setIssuer(issuer).setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(key);
const request=async(path,body,token,extraHeaders={})=>{
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} :{}),...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,headers:response.headers,body:await response.json()};
};
const consent={displayName:'HTTP fixture',locale:'en',consentVersion:'2026-09-foundation',consentAccepted:true};
before(async()=>{
 h=await database();keys=await generateKeyPair('ES256');
 server=createStagingServer({
  async authenticate(token) {
   if(token==='provider-outage-fixture-token') throw Object.assign(new Error('Private provider outage'),{status:503});
   const {payload}=await jwtVerify(token,keys.publicKey,{issuer,audience:'authenticated',algorithms:['ES256'],requiredClaims:['sub','iat','exp']});
   if(payload.role!=='authenticated' || payload.is_anonymous) throw new Error('Identity rejected');
   return {id:payload.sub,claims:payload};
  },
  async rpc(actor,name,params){return h.rpc(actor.claims,name,params);},
  async read(actor,table){return h.as(actor.claims,async tx=>(await tx.query(`select * from public.${table}`)).rows);},
  async requestOtp(){authRequests++;throw new Error('Secret provider detail');},
  async verifyOtp(){throw new Error('Bad OTP');},
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await new Promise(resolve=>server?.close(resolve));await h?.db.close();});
test('staging health is clearly separate from demo and disallows browser origins',async()=>{
 const r=await request('/health');assert.equal(r.body.demo,false);assert.equal(r.body.readyForProduction,false);
 assert.equal((await request('/health',undefined,undefined,{Origin:'https://example.com'})).status,403);
});
test('missing, tampered, expired, foreign-issuer and foreign-audience tokens are rejected',async()=>{
 assert.equal((await request('/v1/me')).status,401);
 const good=await sign(1);const foreign=await generateKeyPair('ES256');
 const expired=await new SignJWT(claims(1)).setProtectedHeader({alg:'ES256'}).setIssuer(issuer).setAudience('authenticated').setIssuedAt().setExpirationTime('0s').sign(keys.privateKey);
 const badIssuer=await new SignJWT(claims(1)).setProtectedHeader({alg:'ES256'}).setIssuer('urn:wrong').setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
 const badAudience=await new SignJWT(claims(1)).setProtectedHeader({alg:'ES256'}).setIssuer(issuer).setAudience('wrong').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
 for(const token of [good.slice(0,-10)+'0123456789',await sign(1,{},foreign.privateKey),expired,badIssuer,badAudience,await sign(1,{is_anonymous:true})])
  assert.equal((await request('/v1/me',undefined,token)).status,401);
});
test('authenticated customer onboarding persists through HTTP and is isolated by real RLS',async()=>{
 const token=await sign(1);
 const r=await request('/v1/onboarding/customer',consent,token);assert.equal(r.status,200);assert.equal(r.body.result.user_id,id(1));
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.equal(r.headers.get('content-security-policy'),"default-src 'none'");
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 assert.equal(r.headers.get('x-frame-options'),'DENY');
 assert.equal(r.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.equal(r.headers.get('permissions-policy'),'camera=(), geolocation=(), microphone=()');
 assert.equal((await request('/v1/onboarding/customer',undefined,await sign(2))).body.length,0);
 assert.equal((await request('/v1/onboarding/customer',undefined,token)).body.length,1);
});
test('mass assignment, false consent and malformed structured names fail closed',async()=>{
 const token=await sign(1);
 for(const input of [{...consent,role:'super_admin'},{...consent,userId:id(2)},{...consent,consentAccepted:false},{...consent,displayName:{trim:'bad'}}])
  assert.equal((await request('/v1/onboarding/customer',input,token)).status,400);
 assert.equal((await request('/v1/onboarding/customer',consent,token,{'content-type':'text/plain'})).status,415);
 assert.equal((await request('/v1/onboarding/customer',{...consent,displayName:'X'.repeat(18000)},token)).status,413);
});
test('partner draft, document submission and denied review traverse HTTP and SQL',async()=>{
 const token=await sign(3);await request('/v1/onboarding/customer',consent,token);
 const created=await request('/v1/onboarding/applications',{cityId:id(100),accountKind:'driver'},token);
 assert.equal(created.status,200);const applicationId=created.body.result.id;
 for(const kind of ['identity','police','permit','insurance']) assert.equal((await request('/v1/onboarding/documents',{applicationId,kind,objectPath:`${id(3)}/${id(200)}`},token)).status,200);
 const submissions=await Promise.all([request('/v1/onboarding/submit',{applicationId},token),request('/v1/onboarding/submit',{applicationId},token)]);
 assert.deepEqual(submissions.map(r=>r.status).sort(),[200,409]);
 assert.equal((await request('/v1/staff/reviews',{applicationId,decision:'approve'},token)).status,403);
 assert.equal((await request('/v1/staff/assignments',{applicationId,fieldOfficerId:id(5)},await sign(9,{aal:'aal2'}))).status,200);
 assert.equal((await request('/v1/staff/reviews',{applicationId,decision:'staff_review'},await sign(5,{aal:'aal2'}))).status,403);
 assert.equal((await request('/v1/onboarding/applications',undefined,await sign(2))).body.length,0);
});
test('provider failures never return successful authentication or secret details',async()=>{
 const outage=await request('/v1/me',undefined,'provider-outage-fixture-token');
 assert.equal(outage.status,503);assert.deepEqual(outage.body,{error:'AUTH_PROVIDER_UNAVAILABLE'});
 const result=await request('/v1/auth/otp',{phone:'+919999999999',captchaToken:'fixture-not-a-real-captcha'});
 assert.equal(result.status,503);assert.deepEqual(result.body,{error:'AUTH_PROVIDER_UNAVAILABLE'});
 const verification=await request('/v1/auth/verify',{phone:'+919999999999',token:'123456'});
 assert.equal(verification.status,401);assert.equal(JSON.stringify(verification.body).includes('123456'),false);
});
test('OTP request and verification attempts have independent local rate limits',async()=>{
 for(let i=0;i<4;i++) await request('/v1/auth/otp',{phone:'+919999999999',captchaToken:'fixture'});
 assert.equal((await request('/v1/auth/otp',{phone:'+919999999999',captchaToken:'fixture'})).status,429);assert.equal(authRequests,5);
 for(let i=0;i<9;i++) await request('/v1/auth/verify',{phone:'+919999999999',token:'123456'});
 assert.equal((await request('/v1/auth/verify',{phone:'+919999999999',token:'123456'})).status,429);
});
test('no arbitrary RPC, demo code, payment or online activation endpoint exists',async()=>{
 for(const path of ['/api/demo/customer-code','/v1/payments','/v1/partners/online','/v1/rpc/arbitrary'])
  assert.equal((await request(path,{},await sign(9,{aal:'aal2'}))).status,404);
});
