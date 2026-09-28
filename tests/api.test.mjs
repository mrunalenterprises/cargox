import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createDemoServer } from "../apps/demo/server.mjs";

let server,base;
before(async()=>{server=createDemoServer().server;server.listen(0,"127.0.0.1");await once(server,"listening");base="http://127.0.0.1:"+server.address().port});
after(async()=>{if(server)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))});
const read=async(path)=>{const r=await fetch(base+path);return {status:r.status,data:await r.json()}};
const post=async(path,value)=>{const r=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});return {status:r.status,data:await r.json()}};
test("public demo identifies itself explicitly and static UI is served",async()=>{
 const health=await read("/api/health");assert.equal(health.data.readyForProduction,false);
 const page=await fetch(base+"/");assert.equal(page.status,200);
 const html=await page.text();assert.match(html,/Daily Services/);assert.match(html,/Pink Rider/);
 const css=await fetch(base+"/styles.css");assert.equal(css.status,200);
 const js=await fetch(base+"/app.js");assert.equal(js.status,200);
});
test("customer -> partner -> 4-digit OTP -> trip -> completed -> admin is working demo flow",async()=>{
 let r=await post("/api/rides",{service:"auto",pickup:"Home",drop:"Office",distanceKm:7});
 assert.equal(r.status,201);const id=r.data.id;assert.equal(r.data.state,"REQUESTED");
 let offers=await read("/api/offers?partnerId=demo-auto-01");
 assert.equal(offers.data.some(x=>x.id===id),true);
 r=await post("/api/rides/"+id+"/accept",{partnerId:"demo-auto-01"});
 assert.equal(r.status,200);assert.equal(r.data.state,"ASSIGNED");
 assert.equal(Object.hasOwn(r.data,"code"),false);
 const code=await read("/api/demo/customer-code?rideId="+id);
 assert.match(code.data.code,/^\d{4}$/);
 r=await post("/api/rides/"+id+"/start",{partnerId:"demo-auto-01",code:code.data.code});
 assert.equal(r.status,200);assert.equal(r.data.state,"IN_PROGRESS");
 r=await post("/api/rides/"+id+"/finish",{partnerId:"demo-auto-01"});
 assert.equal(r.status,200);assert.equal(r.data.state,"COMPLETED");
 const admin=await read("/api/admin");assert.equal(admin.data.rides.some(x=>x.id===id&&x.state==="COMPLETED"),true);
});
test("Pink Rider Only has no silent substitution and can match woman opted-in demo partner",async()=>{
 const r=await post("/api/rides",{service:"car",pickup:"Campus",drop:"Home",distanceKm:4,pinkOnly:true,allPassengersWomenVerified:true});
 assert.equal(r.status,201);const id=r.data.id;
 const regular=await read("/api/offers?partnerId=demo-auto-01");
 assert.equal(regular.data.some(x=>x.id===id),false);
 const pink=await read("/api/offers?partnerId=demo-pink-01");
 assert.equal(pink.data.some(x=>x.id===id),true);
 const rejected=await post("/api/rides/"+id+"/accept",{partnerId:"demo-auto-01"});
 assert.equal(rejected.status,400);assert.equal(rejected.data.error,"INELIGIBLE");
});
test("monthly commute pricing validates dates, counts return legs, never silently sells subscription",async()=>{
 const r=await post("/api/plans/quote",{service:"auto",pickup:"Home",drop:"Office",distanceKm:9,
  startDate:"2026-09-28",endDate:"2026-10-02",weekdays:[1,2,3,4,5],pickupTime:"08:00",returnTime:"17:00"});
 assert.equal(r.status,200);assert.equal(r.data.legs.length,10);
 assert.equal(r.data.totalPaise,r.data.perLegQuote.farePaise*10);
 assert.equal(r.data.requiresConsentBeforePurchase,true);
});
test("live school/child route is not available through generic booking endpoint",async()=>{
 const r=await post("/api/rides",{service:"auto",pickup:"Home",drop:"School",distanceKm:3,childTrip:true});
 assert.equal(r.status,400);assert.equal(r.data.error,"CHILD_SERVICE_GATED");
});

test('quotes use server rates and respect service gates', async()=>{
 const q=await post('/api/quotes',{service:'car',distanceKm:8,farePaise:1});
 assert.equal(q.status,200);assert.equal(q.data.farePaise,19200);
 for(const service of ['bike','shared','outstation']) {
  const blocked=await post('/api/quotes',{service,distanceKm:8});
  assert.equal(blocked.status,400);assert.equal(blocked.data.error,'UNAVAILABLE');
 }
});
test('scheduled Car preserves city-local time and rejects impossible dates',async()=>{
 const body={service:'car',pickup:'Home',drop:'Office',distanceKm:8,mode:'schedule'};
 const invalid=await post('/api/rides',{...body,scheduledAt:'2026-02-30T09:00'});
 assert.equal(invalid.status,400);assert.equal(invalid.data.error,'INVALID_DATE');
 const valid=await post('/api/rides',{...body,scheduledAt:'2026-10-01T09:00'});
 assert.equal(valid.status,201);assert.equal(valid.data.mode,'schedule');
 assert.equal(valid.data.scheduledAt,'2026-10-01T09:00');
});
test('unpaid pack listing preserves Pink and separate legs without dispatch',async()=>{
 const body={service:'car',pickup:'Home',drop:'Office',distanceKm:8,
  startDate:'2026-10-01',endDate:'2026-10-02',weekdays:[4,5],pickupTime:'09:00',returnTime:'18:00',
  pinkOnly:true,allPassengersWomenVerified:true,preferredPartnerId:'demo-pink-01'};
 const denied=await post('/api/plans/quote',{...body,allPassengersWomenVerified:false});
 assert.equal(denied.data.error,'CUSTOMER_ELIGIBILITY');
 const before=await read('/api/rides');const saved=await post('/api/plans/demo',body);
 assert.equal(saved.status,201);assert.equal(saved.data.state,'DEMO_UNPAID');
 const plans=await read('/api/plans');const plan=plans.data.find(p=>p.id===saved.data.id);
 assert.equal(plan.pinkOnly,true);assert.equal(plan.preferredPartnerId,'demo-pink-01');
 assert.deepEqual(plan.legs.map(l=>l.leg),['outbound','return','outbound','return']);
 assert.equal((await read('/api/rides')).data.length,before.data.length);
});
