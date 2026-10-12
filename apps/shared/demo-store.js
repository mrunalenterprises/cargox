const STORAGE_KEY='loadin.demo.v1';

function now(){return new Date().toISOString()}
function id(prefix){const raw=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;return `${prefix}-${raw}`}

function seed(){return {
  version:1,
  partnerOnline:false,
  bookings:[
    {id:'LDN-DEMO-COMPLETE',customer_id:'DEMO-CUSTOMER',partner_id:'DEMO-PARTNER',vehicle_id:'DEMO-TATA-ACE',city_code:'CSN',service_code:'LOADING_VEHICLE',status:'COMPLETED',booking_mode:'NOW',scheduled_at:null,goods_description:'Office Material',pickup_address:'Cidco, Sambhaji Nagar',drop_address:'Waluj MIDC',vehicle_class:'TATA_ACE',fare_locked:true,locked_fare:780,customer_payment_mode:'CASH',created_at:new Date(Date.now()-86400000).toISOString(),updated_at:now(),completed_at:now()}
  ],
  offers:[],
  events:[]
}}

export function createDemoStore({storage=globalThis.localStorage}={}){
  let memory=seed();
  function read(){
    if(!storage)return structuredClone(memory);
    try{const raw=storage.getItem(STORAGE_KEY);if(!raw){storage.setItem(STORAGE_KEY,JSON.stringify(memory));return structuredClone(memory)}return JSON.parse(raw)}catch{return structuredClone(memory)}
  }
  function write(next){
    memory=structuredClone(next);
    if(storage){try{storage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}}
    return structuredClone(next);
  }
  function mutate(fn){const s=read();fn(s);return write(s)}
  function reset(){memory=seed();if(storage){try{storage.removeItem(STORAGE_KEY)}catch{}}return read()}
  function createBooking(input){
    const booking={id:id('LDN'),customer_id:'DEMO-CUSTOMER',partner_id:null,vehicle_id:null,city_code:input.cityCode||'CSN',service_code:input.serviceCode,status:'SEARCHING',booking_mode:input.bookingMode||'NOW',scheduled_at:input.scheduledAt?new Date(input.scheduledAt).toISOString():null,goods_description:input.goodsDescription||'',pickup_address:input.pickupAddress||'',drop_address:input.dropAddress||'',vehicle_class:input.vehicleClass||null,fare_locked:true,locked_fare:Number(input.lockedFare||0),customer_payment_mode:input.paymentMode||'CASH',created_at:now(),updated_at:now(),completed_at:null,cancelled_at:null};
    mutate(s=>{s.bookings.unshift(booking);s.offers.unshift({id:id('OFR'),booking_id:booking.id,partner_id:'DEMO-PARTNER',vehicle_id:'DEMO-TATA-ACE',wave:1,score:94.8,status:'OFFERED',offered_at:now(),expires_at:new Date(Date.now()+20*60*1000).toISOString(),responded_at:null});s.events.unshift({id:id('EVT'),booking_id:booking.id,type:'BOOKING_CREATED',created_at:now()})});
    return structuredClone(booking);
  }
  function myBookings(){return read().bookings.filter(b=>b.customer_id==='DEMO-CUSTOMER')}
  function partnerBookings(){return read().bookings.filter(b=>b.partner_id==='DEMO-PARTNER')}
  function partnerOffers(){const s=read();return s.offers.filter(o=>o.partner_id==='DEMO-PARTNER'&&o.status==='OFFERED').map(o=>({...o,booking:s.bookings.find(b=>b.id===o.booking_id)||null}))}
  function setPartnerOnline(online){mutate(s=>{s.partnerOnline=Boolean(online);s.events.unshift({id:id('EVT'),type:online?'PARTNER_ONLINE':'PARTNER_OFFLINE',created_at:now()})});return {partner_id:'DEMO-PARTNER',online_status:online?'ONLINE':'OFFLINE',updated_at:now()}}
  function acceptOffer(bookingId){
    let result=null;
    mutate(s=>{const b=s.bookings.find(x=>x.id===bookingId);if(!b)throw new Error('booking_not_found');b.partner_id='DEMO-PARTNER';b.vehicle_id='DEMO-TATA-ACE';b.status='ASSIGNED';b.updated_at=now();for(const o of s.offers.filter(x=>x.booking_id===bookingId)){o.status=o.partner_id==='DEMO-PARTNER'?'ACCEPTED':'CANCELLED';o.responded_at=now()}s.events.unshift({id:id('EVT'),booking_id:bookingId,type:'PARTNER_ACCEPTED',created_at:now()});result={...b}});
    return result;
  }
  function declineOffer(bookingId){mutate(s=>{for(const o of s.offers.filter(x=>x.booking_id===bookingId&&x.partner_id==='DEMO-PARTNER')){o.status='DECLINED';o.responded_at=now()}s.events.unshift({id:id('EVT'),booking_id:bookingId,type:'PARTNER_DECLINED',created_at:now()})});return true}
  function setBookingStatus(bookingId,status){let result=null;mutate(s=>{const b=s.bookings.find(x=>x.id===bookingId);if(!b)throw new Error('booking_not_found');b.status=status;b.updated_at=now();if(status==='COMPLETED')b.completed_at=now();s.events.unshift({id:id('EVT'),booking_id:bookingId,type:`STATUS_${status}`,created_at:now()});result={...b}});return result}
  function adminSnapshot(){
    const s=read(),bookings=s.bookings;const completed=bookings.filter(b=>b.status==='COMPLETED');const active=bookings.filter(b=>!['COMPLETED','CANCELLED','FAILED'].includes(b.status));const gbv=bookings.reduce((a,b)=>a+Number(b.locked_fare||0),0);const commission=Math.round(completed.reduce((a,b)=>a+Number(b.locked_fare||0),0)*.15);
    return {metrics:{bookings:bookings.length,active:active.length,completed:completed.length,cancelled:bookings.filter(b=>b.status==='CANCELLED').length,gbv,onlinePartners:s.partnerOnline?1:0,customers:1,pendingPayout:Math.round(completed.reduce((a,b)=>a+Number(b.locked_fare||0),0)*.85),netRevenue:commission,health:94},liveOps:active.map(b=>({id:b.id,type:b.status==='SEARCHING'?'Unassigned Booking':'Active Trip',route:`${b.pickup_address} → ${b.drop_address}`,severity:b.status==='SEARCHING'?'P1':'P2',status:b.status})),partners:[{id:'DEMO-PARTNER',name:'LOADIN Demo Partner',vehicle:'Tata Ace',quality:94,status:s.partnerOnline?'ACTIVE':'OFFLINE'}],bookings:bookings.map(b=>({id:b.id,service:b.service_code,fare:Number(b.locked_fare||0),status:b.status,pickup_address:b.pickup_address,drop_address:b.drop_address}))}
  }
  function fleetSnapshot(){const s=read();return {vehicles:[{id:'DEMO-TATA-ACE',type:'Tata Ace',status:s.partnerOnline?'ACTIVE':'OFFLINE',driver:'Demo Driver',util:72,docs:'Valid'}],drivers:[{id:'DEMO-PARTNER',name:'Demo Driver',phone:'98XXXXXX00',status:s.partnerOnline?'ONLINE':'OFFLINE',quality:94,vehicle:'DEMO-TATA-ACE'}],bookings:s.bookings.filter(b=>b.partner_id==='DEMO-PARTNER').map(b=>({...b,route:`${b.pickup_address} → ${b.drop_address}`,vehicle:b.vehicle_class||'Tata Ace',driver:'Demo Driver',fare:Number(b.locked_fare||0)}))}}
  return {read,reset,createBooking,myBookings,partnerBookings,partnerOffers,setPartnerOnline,acceptOffer,declineOffer,setBookingStatus,adminSnapshot,fleetSnapshot};
}

export const demoStore=createDemoStore();
export {STORAGE_KEY};
