const OPS_KEY='loadin.ops.v1';
export const WEEKDAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];

function clone(v){return structuredClone(v)}
function nowIso(){return new Date().toISOString()}
function uid(prefix){const raw=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;return `${prefix}-${raw}`}
function seed(){return {recurringRoutes:[],replacementCases:[],partnerReviews:[{partnerId:'DEMO-PARTNER',status:'PENDING',checks:{profile:true,personalDocs:true,selfie:true,vehicle:true,vehicleDocs:true,bank:true,pricing:true},notes:[],updatedAt:nowIso()}],compliance:[{entity:'MH20AB1234',kind:'Vehicle',document:'Insurance',expiresInDays:41},{entity:'MH20EF8910',kind:'Vehicle',document:'PUC',expiresInDays:7},{entity:'Demo Driver',kind:'Driver',document:'Driving Licence',expiresInDays:112},{entity:'Demo Driver',kind:'Driver',document:'Identity Selfie',expiresInDays:0}]}}

function dateKey(d){return d.toISOString().slice(0,10)}
export function generateRecurringOccurrences({startDate,time='09:00',weekdays=['MON'],count=8}){
  const start=new Date(`${startDate}T00:00:00Z`);if(Number.isNaN(start.getTime()))throw new Error('invalid_start_date');
  const wanted=new Set(weekdays.map(x=>String(x).toUpperCase()));if(!wanted.size)throw new Error('weekdays_required');
  const rows=[];for(let offset=0;offset<370&&rows.length<count;offset++){const d=new Date(start.getTime()+offset*86400000);if(wanted.has(WEEKDAYS[d.getUTCDay()]))rows.push({date:dateKey(d),time,status:'PLANNED'});}return rows;
}
export function replacementSettlement({originalFare,completionPct=0,commissionRate=.15}){
  const fare=Math.max(0,Number(originalFare||0));const done=Math.min(100,Math.max(0,Number(completionPct||0)));const remaining=Math.round(fare*(1-done/100));const platformCommission=Math.round(fare*commissionRate);const replacementEntitlement=Math.round(remaining*(1-commissionRate));return {originalFare:fare,originalPartnerPayout:0,remainingWorkFare:remaining,platformCommission,replacementEntitlement,customerExtraPay:0};
}
export function reviewDecision(checks={}){const required=['profile','personalDocs','selfie','vehicle','vehicleDocs','bank','pricing'];const missing=required.filter(k=>!checks[k]);return {ready:missing.length===0,missing,status:missing.length?'NEEDS_ACTION':'READY_FOR_APPROVAL'};}
export function complianceSummary(rows=[]){const expired=rows.filter(r=>Number(r.expiresInDays)<=0);const expiring=rows.filter(r=>Number(r.expiresInDays)>0&&Number(r.expiresInDays)<=14);const healthy=rows.filter(r=>Number(r.expiresInDays)>14);return {total:rows.length,expired:expired.length,expiring:expiring.length,healthy:healthy.length,blockedEntities:[...new Set(expired.map(r=>r.entity))],attention:[...expired,...expiring]};}

export function createOperationsStore({storage=globalThis.localStorage}={}){
  let memory=seed();
  function read(){if(!storage)return clone(memory);try{const raw=storage.getItem(OPS_KEY);if(!raw){storage.setItem(OPS_KEY,JSON.stringify(memory));return clone(memory)}return {...seed(),...JSON.parse(raw)}}catch{return clone(memory)}}
  function write(v){memory=clone(v);if(storage){try{storage.setItem(OPS_KEY,JSON.stringify(v))}catch{}}return clone(v)}
  function mutate(fn){const s=read();fn(s);return write(s)}
  function addRecurringRoute(input){let route;mutate(s=>{route={id:uid('RCR'),name:input.name||'Repeat Route',pickup:input.pickup,drop:input.drop,service:input.service||'LOADING_VEHICLE',weekdays:input.weekdays||['MON'],time:input.time||'09:00',preferredPartner:Boolean(input.preferredPartner),active:true,occurrences:generateRecurringOccurrences({startDate:input.startDate,weekdays:input.weekdays||['MON'],time:input.time||'09:00',count:8}),createdAt:nowIso()};s.recurringRoutes.unshift(route)});return clone(route)}
  function pauseRecurringRoute(id){let out;mutate(s=>{const r=s.recurringRoutes.find(x=>x.id===id);if(!r)throw new Error('route_not_found');r.active=false;out=clone(r)});return out}
  function createReplacementCase({bookingId,originalFare,completionPct,reason='BREAKDOWN'}){let item;mutate(s=>{item={id:uid('RPL'),bookingId,reason,status:'SEARCHING_REPLACEMENT',settlement:replacementSettlement({originalFare,completionPct}),createdAt:nowIso(),updatedAt:nowIso()};s.replacementCases.unshift(item)});return clone(item)}
  function assignReplacement(id,partner='Backup Partner'){let out;mutate(s=>{const c=s.replacementCases.find(x=>x.id===id);if(!c)throw new Error('replacement_case_not_found');c.status='REPLACEMENT_ASSIGNED';c.replacementPartner=partner;c.updatedAt=nowIso();out=clone(c)});return out}
  function updatePartnerReview(partnerId,{checks,status,note}={}){let out;mutate(s=>{let r=s.partnerReviews.find(x=>x.partnerId===partnerId);if(!r){r={partnerId,status:'PENDING',checks:{},notes:[],updatedAt:nowIso()};s.partnerReviews.push(r)}if(checks)r.checks={...r.checks,...checks};const decision=reviewDecision(r.checks);if(status)r.status=status;else r.status=decision.ready?'READY_FOR_APPROVAL':'NEEDS_ACTION';if(note)r.notes.unshift({text:note,createdAt:nowIso()});r.updatedAt=nowIso();out=clone(r)});return out}
  function approvePartner(partnerId){const r=updatePartnerReview(partnerId,{status:'APPROVED'});return {...r,approvedAt:nowIso()}}
  function addCompliance(item){mutate(s=>s.compliance.unshift({...item}));return complianceSummary(read().compliance)}
  function reset(){memory=seed();if(storage){try{storage.removeItem(OPS_KEY)}catch{}}return read()}
  return {read,reset,addRecurringRoute,pauseRecurringRoute,createReplacementCase,assignReplacement,updatePartnerReview,approvePartner,addCompliance,compliance:()=>complianceSummary(read().compliance)};
}
export const operationsStore=createOperationsStore();
export {OPS_KEY};
