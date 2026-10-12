import { demoStore } from './demo-store.js';

const KEY='loadin.experience.v1';
const ONBOARDING_STEPS=['PROFILE','PERSONAL_DOCS','SELFIE','VEHICLE','VEHICLE_DOCS','BANK','PRICING','FINAL_REVIEW'];

function readStorage(){
  try{const raw=globalThis.localStorage?.getItem(KEY);return raw?JSON.parse(raw):null}catch{return null}
}
function writeStorage(value){try{globalThis.localStorage?.setItem(KEY,JSON.stringify(value))}catch{}return structuredClone(value)}
function seed(){return {onboarding:{completed:['PROFILE','PERSONAL_DOCS'],updated_at:new Date().toISOString()},notifications:[]}}
function state(){return readStorage()||writeStorage(seed())}
function latestBooking(){const rows=demoStore.myBookings();return rows.find(b=>!['CANCELLED','FAILED'].includes(b.status))||rows[0]||null}
function progressFor(status){return ({SEARCHING:12,ASSIGNED:28,PARTNER_ARRIVING:40,AT_PICKUP:52,IN_PROGRESS:72,COMPLETED:100,CANCELLED:0})[status]??18}
function routePoints(){return [
  {label:'Pickup',lat:19.8762,lng:75.3433},
  {label:'Partner',lat:19.8638,lng:75.3301},
  {label:'En route',lat:19.8494,lng:75.3037},
  {label:'Drop',lat:19.8421,lng:75.2794},
]}
function serviceLabel(code){return ({PARCEL_2W:'2-Wheeler Parcel',LOADING_VEHICLE:'Loading Vehicle',HELPER:'Helper',FULL_SHIFTING:'Full Shifting'})[code]||code||'Loading Vehicle'}

export const experienceStore={
  tracking(){
    const booking=latestBooking();
    if(!booking)return {empty:true,status:'NO_BOOKING',progress:0,points:routePoints()};
    return {empty:false,id:booking.id,status:booking.status,progress:progressFor(booking.status),pickup:booking.pickup_address,drop:booking.drop_address,service:serviceLabel(booking.service_code),vehicle:booking.vehicle_class||'Tata Ace',fare:Number(booking.locked_fare||0),partner:booking.partner_id?'Demo Driver':'Searching verified partner',eta:booking.status==='IN_PROGRESS'?'18 min':booking.status==='COMPLETED'?'Delivered':'8 min',points:routePoints()};
  },
  payment(){
    const booking=latestBooking();const fare=Number(booking?.locked_fare||0);const commission=Math.round(fare*.15);return {bookingId:booking?.id||null,fare,mode:booking?.customer_payment_mode||'CASH',fareLocked:Boolean(booking?.fare_locked),extras:0,customerTotal:fare,platformCommission:commission,partnerEntitlement:fare-commission,gatewayFeeChargedToCustomer:0};
  },
  notifications(){
    const b=latestBooking();
    const base=[
      {id:'N1',title:'Fare Lock active',body:'Your confirmed fare cannot increase except approved extras.',type:'FARE'},
      {id:'N2',title:'Trip proof protected',body:'Pickup and delivery proof stay attached to the booking.',type:'SAFETY'},
    ];
    if(b?.status==='SEARCHING')base.unshift({id:'N0',title:'Finding a verified partner',body:`LOADIN is matching ${serviceLabel(b.service_code)} partners near pickup.`,type:'LIVE'});
    if(b?.status==='ASSIGNED')base.unshift({id:'N0',title:'Partner assigned',body:'Your verified partner is preparing to reach pickup.',type:'LIVE'});
    if(b?.status==='IN_PROGRESS')base.unshift({id:'N0',title:'Trip in progress',body:'Live tracking and trip sharing are active for this booking.',type:'LIVE'});
    if(b?.status==='COMPLETED')base.unshift({id:'N0',title:'Delivery completed',body:'Trip completed. Proof and fare summary are ready.',type:'DONE'});
    return base;
  },
  shifting(){
    const b=latestBooking();
    return {bookingId:b?.id||'SHIFT-DEMO',inventory:[{item:'Bed / Cot',qty:1,fragile:false},{item:'Cupboard',qty:2,fragile:false},{item:'TV',qty:1,fragile:true},{item:'Boxes',qty:14,fragile:false}],packing:'Standard + fragile protection',team:['Supervisor','Driver','2 Helpers','Packing Specialist'],inspectionRequired:true,quote:Number(b?.service_code==='FULL_SHIFTING'?b.locked_fare:2199),stages:['Inventory','Inspection','Quote Locked','Packing','Loading','In Transit','Delivery Proof','Completed']};
  },
  onboarding(){const s=state();return {steps:ONBOARDING_STEPS.map(code=>({code,done:s.onboarding.completed.includes(code)})),completed:s.onboarding.completed.length,total:ONBOARDING_STEPS.length,percent:Math.round(s.onboarding.completed.length/ONBOARDING_STEPS.length*100),updatedAt:s.onboarding.updated_at};},
  completeStep(code){if(!ONBOARDING_STEPS.includes(code))throw new Error('invalid_step');const s=state();if(!s.onboarding.completed.includes(code))s.onboarding.completed.push(code);s.onboarding.updated_at=new Date().toISOString();writeStorage(s);return this.onboarding();},
  resetOnboarding(){const s=state();s.onboarding={completed:['PROFILE','PERSONAL_DOCS'],updated_at:new Date().toISOString()};writeStorage(s);return this.onboarding();},
  reset(){try{globalThis.localStorage?.removeItem(KEY)}catch{}return state();}
};

export {ONBOARDING_STEPS};
