import { randomUUID, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export const SERVICES = Object.freeze(["bike", "auto", "car", "outstation", "shared"]);
export const MODES = Object.freeze(["now", "schedule", "daily", "monthly"]);
export class DomainError extends Error {
  constructor(code, message) { super(message); this.name = "DomainError"; this.code = code; }
}
const fail=(code,message)=>{throw new DomainError(code,message);};
const today=(d)=>{if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail("INVALID_DATE","Use YYYY-MM-DD");const ms=Date.parse(d+"T00:00:00Z");if (!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==d) fail("INVALID_DATE","Invalid calendar date");return ms;};
const time=(v)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v||"")) fail("INVALID_TIME","Use HH:mm");return v;};
const money=(n)=>{if(!Number.isSafeInteger(n)||n<0)fail("INVALID_MONEY","Integer paise required");return n;};
const datePlus=(ms)=>new Date(ms).toISOString().slice(0,10);
const publicRide=(r)=>{const {hash,salt,code,attempts,...publicData}=r;return {...publicData};};

// All dates/times are service-city-local civil strings. Demo's configured city is Asia/Kolkata;
// scheduling in other time zones must implement an IANA-zone-aware production adapter.
export function generateOccurrences({startDate,endDate,weekdays,pickupTime,returnTime=null,limit=124}) {
  const start=today(startDate), end=today(endDate); time(pickupTime);
  if(returnTime!==null) time(returnTime);
  if(start>end || end-start>1000*60*60*24*62) fail("INVALID_RANGE","Max 63-day recurring range");
  if(!Array.isArray(weekdays)||!weekdays.length||weekdays.some(x=>!Number.isInteger(x)||x<1||x>7)) fail("INVALID_WEEKDAYS","Use weekdays 1=Mon through 7=Sun");
  const selected=new Set(weekdays), list=[];
  for(let ms=start;ms<=end;ms+=86400000){
    const isoDay=new Date(ms).getUTCDay()||7;
    if(!selected.has(isoDay))continue;
    const date=datePlus(ms);
    list.push({date,time:pickupTime,leg:"outbound"});
    if(returnTime!==null) list.push({date,time:returnTime,leg:"return"});
    if(list.length>limit)fail("PLAN_TOO_LARGE","Choose fewer days or a shorter plan");
  }
  if(!list.length)fail("EMPTY_SCHEDULE","No dates match selected weekdays");
  return list;
}

export class RideEngine {
  constructor() {
    this.cities=new Map([["sambhajinagar",{id:"sambhajinagar",name:"Chhatrapati Sambhajinagar",timezone:"Asia/Kolkata",
      services:{bike:false,auto:true,car:true,outstation:false,shared:false}, legalDemoOnly:true}]]);
    this.partners=new Map();
    this.rides=new Map();
    this.plans=new Map();
    this.payments=new Map();
    this.audit=[];
    this.ratePaisePerKm={auto:1700,car:2400,bike:900,outstation:2600,shared:1100};
    this.commissionBps=2500; // demo placeholder 25%, NOT a final commercial/legal rate
  }
  registerDemoPartner(input) {
    if(!input.id || this.partners.has(input.id)) fail("PARTNER_EXISTS","Distinct partner id required");
    const partner={id:input.id,name:input.name||input.id,services:input.services||["auto","car"],
      approved:!!input.approved,docsValid:!!input.docsValid,online:!!input.online,
      identityVerified:!!input.identityVerified, womanVerified:!!input.womanVerified,
      pinkOptIn:!!input.pinkOptIn,pinkMode:input.pinkMode||"women_only",
      childEligible:false,cityId:input.cityId||"sambhajinagar"};
    if(!["women_only","all"].includes(partner.pinkMode))fail("INVALID_PREFERENCE","Invalid Pink Rider mode");
    this.partners.set(partner.id,partner);return {...partner};
  }
  catalog(cityId="sambhajinagar") {
    const city=this.cities.get(cityId);if(!city)fail("CITY_UNKNOWN","City unavailable");
    return {city,services:SERVICES.map(id=>({id,available:!!city.services[id]})),
      modes:MODES, disclaimer:"LOCAL DEMO ONLY: fare and eligibility are illustrative, no live dispatch or payment."};
  }
  checkService(cityId,service) {
    const c=this.cities.get(cityId);
    if(!c||!SERVICES.includes(service)||!c.services[service])fail("UNAVAILABLE","Service is not enabled in this city");
    return c;
  }
  quote({cityId="sambhajinagar",service,distanceKm}) {
    this.checkService(cityId,service);
    if(typeof distanceKm!=="number"||!Number.isFinite(distanceKm)||distanceKm<=0||distanceKm>500)
      fail("INVALID_DISTANCE","Distance must be 0–500km; actual routing integration pending");
    const farePaise=money(Math.round(distanceKm*this.ratePaisePerKm[service]));
    return Object.freeze({cityId,service,distanceKm,farePaise,platformCommissionPaise:Math.floor(farePaise*this.commissionBps/10000),
      currency:"INR",isEstimate:true,pricingVersion:"DEMO-1",
      note:"Illustrative straight input kilometres, not routed fare; tolls/taxes/refunds not live."});
  }
  partnerEligible(p,ride) {
    if(!p||!p.approved||!p.docsValid||!p.online||!p.identityVerified||p.cityId!==ride.cityId||!p.services.includes(ride.service))return false;
    if(ride.pinkOnly&&!(p.womanVerified&&p.pinkOptIn))return false;
    if(p.pinkOptIn&&p.pinkMode==="women_only"&&!ride.allPassengersWomenVerified)return false;
    if(ride.womenOnlyPool&&!(p.womanVerified&&p.pinkOptIn&&ride.allPassengersWomenVerified))return false;
    if(ride.childTrip&&!p.childEligible)return false; // Live child service deliberately disabled
    return true;
  }
  createRide(data) {
    const {cityId="sambhajinagar",service,pickup,drop,distanceKm,pinkOnly=false,
      allPassengersWomenVerified=false,womenOnlyPool=false,childTrip=false,mode="now",scheduledAt=null,
      monthlyPlanId=null,leg="outbound"}=data;
    this.checkService(cityId,service);
    if(!["now","schedule","daily","monthly"].includes(mode))fail("INVALID_MODE","Invalid booking mode");
    if(!pickup?.trim()||!drop?.trim())fail("INVALID_ROUTE","Pickup and drop required");
    if(childTrip)fail("CHILD_SERVICE_GATED","School/child transport is pending legal and operational review");
    if(womenOnlyPool&&service!=="shared")fail("INVALID_PREFERENCE","Women-only pool requires shared service");
    if(womenOnlyPool&&!allPassengersWomenVerified)fail("GROUP_ELIGIBILITY","Every passenger must satisfy eligibility");
    if(pinkOnly&&!allPassengersWomenVerified)fail("CUSTOMER_ELIGIBILITY","Pink Rider Only requires eligible verified passengers");
    if(mode!=="now" && !(typeof scheduledAt==="string"&&/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(scheduledAt)))
      fail("INVALID_SCHEDULE","Scheduled trip needs YYYY-MM-DDTHH:mm (local city time)");
    if(mode!=="now")today(scheduledAt.slice(0,10));
    const quote=this.quote({cityId,service,distanceKm});
    const ride={id:randomUUID(),cityId,service,pickup:pickup.trim(),drop:drop.trim(),mode,leg,
      scheduledAt,monthlyPlanId,pinkOnly:!!pinkOnly,allPassengersWomenVerified:!!allPassengersWomenVerified,
      womenOnlyPool:!!womenOnlyPool,childTrip:false,quote,state:"REQUESTED",partnerId:null,
      createdAt:new Date().toISOString(),events:[{state:"REQUESTED",at:new Date().toISOString()}]};
    this.rides.set(ride.id,ride);this.audit.push({action:"ride_created",rideId:ride.id});return publicRide(ride);
  }
  partnerOffers(partnerId) {
    const p=this.partners.get(partnerId);
    if(!p)return [];
    return [...this.rides.values()].filter(r=>r.state==="REQUESTED"&&this.partnerEligible(p,r)).map(publicRide);
  }
  accept(rideId,partnerId) {
    const r=this.rides.get(rideId),p=this.partners.get(partnerId);
    if(!r)fail("RIDE_UNKNOWN","Ride not found");
    if(r.state!=="REQUESTED")fail("RIDE_UNAVAILABLE","Already accepted or otherwise unavailable");
    this.checkService(r.cityId,r.service); // recheck switched-off city
    if(!this.partnerEligible(p,r))fail("INELIGIBLE","Partner cannot accept this ride");
    const active=[...this.rides.values()].some(other=>other.partnerId===partnerId&&["ASSIGNED","IN_PROGRESS"].includes(other.state));
    if(active)fail("PARTNER_BUSY","Partner already has an active ride");
    r.partnerId=partnerId;r.state="ASSIGNED";r.events.push({state:r.state,at:new Date().toISOString()});
    const code=String(randomInt(0,10000)).padStart(4,"0");
    r.salt=randomUUID();r.hash=scryptSync(code,r.salt,32);r.code=code; // demo customer retrieval only; no production persistence
    r.attempts=0;r.codeExpiresAt=Date.now()+10*60*1000;
    this.audit.push({action:"ride_accepted",rideId,partnerId});return publicRide(r);
  }
  customerStartCode(rideId) {
    const r=this.rides.get(rideId);
    if(!r||r.state!=="ASSIGNED")fail("CODE_UNAVAILABLE","Code only available to assigned ride customer");
    return r.code; // NEVER expose as public endpoint without real customer auth
  }
  start(rideId,partnerId,code) {
    const r=this.rides.get(rideId);
    if(!r||r.partnerId!==partnerId||r.state!=="ASSIGNED")fail("INVALID_START","Ride not assigned to partner");
    this.checkService(r.cityId,r.service);
    if(!this.partnerEligible(this.partners.get(partnerId),r))fail("PARTNER_RECHECK","Partner no longer eligible");
    if(Date.now()>r.codeExpiresAt)fail("CODE_EXPIRED","Trip code expired");
    r.attempts++;if(r.attempts>5)fail("OTP_LOCKED","Trip code locked; support required");
    const provided=String(code||"");
    const actual=provided.match(/^\d{4}$/)?scryptSync(provided,r.salt,32):Buffer.alloc(32);
    if(!timingSafeEqual(actual,r.hash))fail("INVALID_OTP","Trip code incorrect");
    r.state="IN_PROGRESS";r.code=null;r.hash=null;r.salt=null;r.events.push({state:r.state,at:new Date().toISOString()});
    this.audit.push({action:"ride_started",rideId});return publicRide(r);
  }
  finish(rideId,partnerId) {
    const r=this.rides.get(rideId);if(!r||r.partnerId!==partnerId||r.state!=="IN_PROGRESS")fail("INVALID_FINISH","Ride must be started by assigned partner");
    r.state="COMPLETED";r.events.push({state:r.state,at:new Date().toISOString()});
    this.audit.push({action:"ride_completed",rideId});return publicRide(r);
  }
  previewPack(data) {
    if(data.childTrip)fail("CHILD_SERVICE_GATED","Child rides need separate approved workflow");
    if(!data.pickup?.trim()||!data.drop?.trim())fail("INVALID_ROUTE","Fixed pickup/drop required");
    if(data.service==="outstation" && !data.intercity)fail("OUTSTATION_ROUTE","Daily outstation requires a defined intercity route");
    if(data.pinkOnly&&!data.allPassengersWomenVerified)fail("CUSTOMER_ELIGIBILITY","Pink Rider pack requires verified passenger eligibility");
    const base=this.quote(data);
    const legs=generateOccurrences(data);
    const total=money(base.farePaise*legs.length);
    return {service:data.service,cityId:data.cityId||"sambhajinagar",pickup:data.pickup.trim(),drop:data.drop.trim(),
      legs,totalPaise:total,currency:"INR",perLegQuote:base,requiresConsentBeforePurchase:true,
      note:"Demo only. No purchased subscription, verified payment or guaranteed driver allocation."};
  }
  createDemoPack(data) {
    const preview=this.previewPack(data);
    const id=randomUUID(), plan={id,...preview,state:"DEMO_UNPAID",pinkOnly:!!data.pinkOnly,
      allPassengersWomenVerified:!!data.allPassengersWomenVerified,preferredPartnerId:data.preferredPartnerId||null};
    if(plan.pinkOnly&&!plan.allPassengersWomenVerified)fail("CUSTOMER_ELIGIBILITY","Pink Rider pack requires verified passenger eligibility");
    // No automatic dispatch; each leg remains pending until manually created and checked.
    this.plans.set(id,plan);this.audit.push({action:"demo_pack_created",planId:id});return plan;
  }
  adminSummary() {return {demo:true,cities:[...this.cities.values()],partners:[...this.partners.values()],
    rides:[...this.rides.values()].map(publicRide),plans:[...this.plans.values()],
    auditCount:this.audit.length,audit:this.audit.map((event,index)=>({sequence:index+1,...event})),
    pricing:{ratePaisePerKm:{...this.ratePaisePerKm},commissionBps:this.commissionBps},
    alert:"Not a live admin dashboard. No real authentication, permits, dispatch or payments."};}
}
