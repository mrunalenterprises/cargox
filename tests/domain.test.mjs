import test from "node:test";
import assert from "node:assert/strict";
import { RideEngine, DomainError, generateOccurrences } from "../packages/cargox_domain/src/index.mjs";

const make=()=>new RideEngine();
const add=(e, id, overrides={})=>e.registerDemoPartner({id,approved:true,docsValid:true,identityVerified:true,online:true,services:["auto","car"],...overrides});
const request=(e,overrides={})=>e.createRide({service:"car",pickup:"Home",drop:"Office",distanceKm:8,...overrides});
const throwsCode=(fn,code)=>assert.throws(fn,e=>e instanceof DomainError&&e.code===code);
test("catalog defaults only auto and car ON; bike/outstation/shared gated",()=>{
 const c=make().catalog();assert.equal(c.services.find(s=>s.id==="car").available,true);
 for(const s of ["bike","outstation","shared"])assert.equal(c.services.find(x=>x.id===s).available,false);
});
test("weekday recurring and separate return legs cross a month boundary",()=>{
 const legs=generateOccurrences({startDate:"2026-09-28",endDate:"2026-10-04",weekdays:[1,3],pickupTime:"08:00",returnTime:"17:30"});
 assert.equal(legs.length,4);assert.deepEqual(legs.map(x=>x.leg),["outbound","return","outbound","return"]);
 assert.deepEqual([...new Set(legs.map(x=>x.date))],["2026-09-28","2026-09-30"]);
});
test("impossible dates and missing scheduledAt rejected",()=>{
 throwsCode(()=>generateOccurrences({startDate:"2026-02-30",endDate:"2026-03-02",weekdays:[1],pickupTime:"08:00"}),"INVALID_DATE");
 throwsCode(()=>request(make(),{mode:"schedule"}),"INVALID_SCHEDULE");
});
test("client cannot book city OFF or not-ready services",()=>{
 const e=make();throwsCode(()=>request(e,{service:"bike"}),"UNAVAILABLE");
 e.cities.get("sambhajinagar").services.car=false;throwsCode(()=>request(e),"UNAVAILABLE");
});
test("partner approval, documents, online and identity rechecked",()=>{
 const e=make();const r=request(e);add(e,"unverified",{docsValid:false});
 throwsCode(()=>e.accept(r.id,"unverified"),"INELIGIBLE");
 e.partners.get("unverified").docsValid=true;e.partners.get("unverified").identityVerified=false;
 throwsCode(()=>e.accept(r.id,"unverified"),"INELIGIBLE");
 e.partners.get("unverified").identityVerified=true;e.accept(r.id,"unverified");
 e.partners.get("unverified").online=false;
 throwsCode(()=>e.start(r.id,"unverified",e.customerStartCode(r.id)),"PARTNER_RECHECK");
});
test("Pink Rider Only never silently falls back to unverified male or non-opted female driver",()=>{
 const e=make();add(e,"regular");add(e,"woman",{womanVerified:true,pinkOptIn:false});
 const r=request(e,{pinkOnly:true,allPassengersWomenVerified:true});
 assert.equal(e.partnerOffers("regular").length,0);assert.equal(e.partnerOffers("woman").length,0);
 throwsCode(()=>e.accept(r.id,"regular"),"INELIGIBLE");
 e.partners.get("woman").pinkOptIn=true;
 assert.equal(e.partnerOffers("woman").length,1);e.accept(r.id,"woman");
 assert.equal(e.rides.get(r.id).partnerId,"woman");
});
test("Pink Women Only drivers do not receive male or unverified group trips",()=>{
 const e=make();add(e,"pink",{womanVerified:true,pinkOptIn:true,pinkMode:"women_only"});
 const r=request(e);assert.equal(e.partnerOffers("pink").length,0);
});
test("no simultaneous accepted rides for one partner",()=>{
 const e=make();add(e,"driver");const a=request(e),b=request(e);
 e.accept(a.id,"driver");throwsCode(()=>e.accept(b.id,"driver"),"PARTNER_BUSY");
 const code=e.customerStartCode(a.id);assert.match(code,/^\d{4}$/);
 throwsCode(()=>e.finish(a.id,"driver"),"INVALID_FINISH");e.start(a.id,"driver",code);e.finish(a.id,"driver");
 e.accept(b.id,"driver");assert.equal(e.rides.get(b.id).state,"ASSIGNED");
});
test("one-time OTP, ownership, invalid attempts and state transitions",()=>{
 const e=make();add(e,"a");add(e,"b");const r=request(e);e.accept(r.id,"a");
 const code=e.customerStartCode(r.id);
 throwsCode(()=>e.start(r.id,"b",code),"INVALID_START");
 throwsCode(()=>e.start(r.id,"a","nope"),"INVALID_OTP");
 assert.equal(e.start(r.id,"a",code).state,"IN_PROGRESS");
 throwsCode(()=>e.start(r.id,"a",code),"INVALID_START");
 assert.equal(e.finish(r.id,"a").state,"COMPLETED");
});
test("OTP locks after five incorrect attempts and customer code not in public ride",()=>{
 const e=make();add(e,"a");const r=request(e);const publicAssigned=e.accept(r.id,"a");
 assert.equal("code" in publicAssigned,false);assert.equal("hash" in publicAssigned,false);
 for(let i=0;i<5;i++)throwsCode(()=>e.start(r.id,"a","----"),"INVALID_OTP");
 throwsCode(()=>e.start(r.id,"a",e.customerStartCode(r.id)),"OTP_LOCKED");
});
test("disabled service after request cannot be accepted",()=>{
 const e=make();add(e,"a");const r=request(e);
 e.cities.get("sambhajinagar").services.car=false;
 throwsCode(()=>e.accept(r.id,"a"),"UNAVAILABLE");
});
test("monthly fixed-route price and entitlement preview are consistent",()=>{
 const e=make();const input={service:"auto",pickup:"Home",drop:"Office",distanceKm:10,
 startDate:"2026-09-28",endDate:"2026-09-30",weekdays:[1,2,3],pickupTime:"08:00",returnTime:"17:00"};
 const quote=e.previewPack(input);assert.equal(quote.legs.length,6);
 assert.equal(quote.totalPaise,quote.perLegQuote.farePaise*6);
 const p=e.createDemoPack(input);assert.equal(p.state,"DEMO_UNPAID");
 assert.equal(e.rides.size,0,"Plan does not automatically dispatch without a confirmed payment");
});
test("school and child journeys cannot launch as generic ride",()=>{
 const e=make();throwsCode(()=>request(e,{childTrip:true}),"CHILD_SERVICE_GATED");
 throwsCode(()=>e.previewPack({service:"car",pickup:"X",drop:"School",distanceKm:3,childTrip:true}),"CHILD_SERVICE_GATED");
});
test("women only shared ride checks entire group; service must be enabled",()=>{
 const e=make();e.cities.get("sambhajinagar").services.shared=true;
 throwsCode(()=>request(e,{service:"shared",womenOnlyPool:true}),"GROUP_ELIGIBILITY");
 const r=request(e,{service:"shared",womenOnlyPool:true,allPassengersWomenVerified:true});
 add(e,"regular");add(e,"pink",{services:["shared"],womanVerified:true,pinkOptIn:true});
 assert.equal(e.partnerOffers("regular").length,0);assert.equal(e.partnerOffers("pink").length,1);
});
