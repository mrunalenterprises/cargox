import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { demoStore } from './demo-store.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});

function eq(v){return `eq.${v}`}
function desc(col){return `${col}.desc`}
function isoOrNull(value){return value?new Date(value).toISOString():null}
async function currentUser(){if(!client.configured)return {id:'DEMO-CUSTOMER',demo:true};const session=client.readSession();if(!session?.access_token)return null;return client.getUser()}

export const loadinData={
  configured:client.configured,
  mode:client.configured?'LIVE':'DEMO',
  demoMode:!client.configured,
  session:()=>client.readSession(),
  sendOtp:(phone)=>client.sendOtp(phone),
  verifyOtp:(input)=>client.verifyOtp(input),
  signOut:()=>client.signOutLocal(),
  currentUser,

  async createBooking({cityCode='CSN',serviceCode,bookingMode='NOW',scheduledAt=null,goodsDescription,pickupAddress,dropAddress,vehicleClass=null,lockedFare=0,paymentMode='ONLINE'}){
    if(!client.configured)return demoStore.createBooking({cityCode,serviceCode,bookingMode,scheduledAt,goodsDescription,pickupAddress,dropAddress,vehicleClass,lockedFare,paymentMode});
    const user=await currentUser();if(!user?.id)throw new Error('login_required');
    const rows=await client.insert('bookings',{customer_id:user.id,city_code:cityCode,service_code:serviceCode,status:'SEARCHING',booking_mode:bookingMode,scheduled_at:isoOrNull(scheduledAt),goods_description:goodsDescription,pickup_address:pickupAddress,drop_address:dropAddress,vehicle_class:vehicleClass,fare_locked:true,locked_fare:lockedFare,customer_payment_mode:paymentMode});
    return Array.isArray(rows)?rows[0]:rows;
  },
  async myBookings(){if(!client.configured)return demoStore.myBookings();const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{customer_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerBookings(){if(!client.configured)return demoStore.partnerBookings();const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerOffers(){if(!client.configured)return demoStore.partnerOffers();const user=await currentUser();if(!user?.id)return [];return client.select('booking_dispatch_offers',{filters:{partner_id:eq(user.id),status:eq('OFFERED')},order:desc('offered_at'),limit:20})},
  async setPartnerOnline(online){if(!client.configured)return demoStore.setPartnerOnline(online);const user=await currentUser();if(!user?.id)throw new Error('login_required');const rows=await client.update('partner_availability',{online_status:online?'ONLINE':'OFFLINE',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()},{partner_id:eq(user.id)});return Array.isArray(rows)?rows[0]:rows},
  async acceptPartnerOffer(bookingId){if(!client.configured)return demoStore.acceptOffer(bookingId);throw new Error('server_acceptance_endpoint_required')},
  async declinePartnerOffer(bookingId){if(!client.configured)return demoStore.declineOffer(bookingId);throw new Error('server_decline_endpoint_required')},
  async setBookingStatus(bookingId,status){if(!client.configured)return demoStore.setBookingStatus(bookingId,status);throw new Error('server_trip_transition_endpoint_required')},
  async partnerEarnings(){if(!client.configured){const rows=demoStore.partnerBookings().filter(b=>b.status==='COMPLETED');return rows.map(b=>({booking_id:b.id,amount:Math.round(Number(b.locked_fare||0)*.85),created_at:b.completed_at||b.updated_at}))}const user=await currentUser();if(!user?.id)return [];return client.select('partner_finance_ledger',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:100})},
  async adminSnapshot(){
    if(!client.configured)return demoStore.adminSnapshot();
    if(!cfg.adminApiBase)throw new Error('admin_api_not_configured');
    const token=client.accessToken();const res=await fetch(`${String(cfg.adminApiBase).replace(/\/$/,'')}/dashboard`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw new Error(`admin_api_${res.status}`);return res.json();
  },
  async fleetSnapshot(){
    if(!client.configured)return demoStore.fleetSnapshot();
    if(!cfg.adminApiBase)throw new Error('fleet_api_not_configured');
    const token=client.accessToken();const res=await fetch(`${String(cfg.adminApiBase).replace(/\/$/,'')}/fleet/me`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw new Error(`fleet_api_${res.status}`);return res.json();
  },
  resetDemo(){if(client.configured)throw new Error('not_demo_mode');return demoStore.reset()},
  subscribe(handler){if(typeof globalThis.addEventListener!=='function')return()=>{};const fn=(event)=>{if(!client.configured&&event.key==='loadin.demo.v1')handler?.()};globalThis.addEventListener('storage',fn);return()=>globalThis.removeEventListener('storage',fn)}
};
