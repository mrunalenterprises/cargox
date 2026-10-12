import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});

function eq(v){return `eq.${v}`}
function desc(col){return `${col}.desc`}
function isoOrNull(value){return value?new Date(value).toISOString():null}

async function currentUser(){const session=client.readSession();if(!session?.access_token)return null;return client.getUser()}

export const loadinData={
  configured:client.configured,
  session:()=>client.readSession(),
  sendOtp:(phone)=>client.sendOtp(phone),
  verifyOtp:(input)=>client.verifyOtp(input),
  signOut:()=>client.signOutLocal(),
  currentUser,

  async createBooking({cityCode='CSN',serviceCode,bookingMode='NOW',scheduledAt=null,goodsDescription,pickupAddress,dropAddress,vehicleClass=null,lockedFare=0,paymentMode='ONLINE'}){
    const user=await currentUser();if(!user?.id)throw new Error('login_required');
    const rows=await client.insert('bookings',{customer_id:user.id,city_code:cityCode,service_code:serviceCode,status:'SEARCHING',booking_mode:bookingMode,scheduled_at:isoOrNull(scheduledAt),goods_description:goodsDescription,pickup_address:pickupAddress,drop_address:dropAddress,vehicle_class:vehicleClass,fare_locked:true,locked_fare:lockedFare,customer_payment_mode:paymentMode});
    return Array.isArray(rows)?rows[0]:rows;
  },
  async myBookings(){const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{customer_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerBookings(){const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerOffers(){const user=await currentUser();if(!user?.id)return [];return client.select('booking_dispatch_offers',{filters:{partner_id:eq(user.id),status:eq('OFFERED')},order:desc('offered_at'),limit:20})},
  async setPartnerOnline(online){const user=await currentUser();if(!user?.id)throw new Error('login_required');const rows=await client.update('partner_availability',{online_status:online?'ONLINE':'OFFLINE',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()},{partner_id:eq(user.id)});return Array.isArray(rows)?rows[0]:rows},
  async partnerEarnings(){const user=await currentUser();if(!user?.id)return [];return client.select('partner_finance_ledger',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:100})},
  async adminSnapshot(){
    if(!cfg.adminApiBase)throw new Error('admin_api_not_configured');
    const token=client.accessToken();const res=await fetch(`${String(cfg.adminApiBase).replace(/\/$/,'')}/dashboard`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw new Error(`admin_api_${res.status}`);return res.json();
  },
  async fleetSnapshot(){
    if(!cfg.adminApiBase)throw new Error('fleet_api_not_configured');
    const token=client.accessToken();const res=await fetch(`${String(cfg.adminApiBase).replace(/\/$/,'')}/fleet/me`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!res.ok)throw new Error(`fleet_api_${res.status}`);return res.json();
  }
};
