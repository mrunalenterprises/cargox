import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { demoStore } from './demo-store.js';
const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
function eq(v){return `eq.${v}`}
function desc(col){return `${col}.desc`}
function isoOrNull(value){return value?new Date(value).toISOString():null}
function demoBookingIdFromOfferRef(ref){const s=demoStore.read();return s.offers.find(o=>o.id===ref)?.booking_id||ref}
function normalizeDispatchOffer(row){return {id:row.offer_id||row.id,offer_id:row.offer_id||row.id,booking_id:row.booking_id,vehicle_id:row.vehicle_id,wave:row.wave,score:row.score,offered_at:row.offered_at,expires_at:row.expires_at,booking:{id:row.booking_id,service_code:row.service_code,city_code:row.city_code,booking_mode:row.booking_mode,scheduled_at:row.scheduled_at,goods_description:row.goods_description,pickup_address:row.pickup_address,drop_address:row.drop_address,vehicle_class:row.vehicle_class,locked_fare:row.locked_fare,customer_payment_mode:row.customer_payment_mode}}}
async function currentUser(){if(!client.configured)return {id:'DEMO-CUSTOMER',demo:true};const session=client.readSession();if(!session?.access_token)return null;return client.getUser()}
async function secureApi(path,options={}){if(!cfg.adminApiBase)throw new Error('secure_api_not_configured');const token=client.accessToken();const res=await fetch(`${String(cfg.adminApiBase).replace(/\/$/,'')}${path}`,{...options,headers:{'content-type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}});if(!res.ok)throw new Error(`secure_api_${res.status}`);return res.status===204?null:res.json()}
export const loadinData={
  configured:client.configured,mode:client.configured?'LIVE':'DEMO',demoMode:!client.configured,session:()=>client.readSession(),sendOtp:(phone)=>client.sendOtp(phone),verifyOtp:(input)=>client.verifyOtp(input),signOut:()=>client.signOutLocal(),currentUser,
  async createBooking({cityCode='CSN',serviceCode,bookingMode='NOW',scheduledAt=null,goodsDescription,pickupAddress,dropAddress,vehicleClass=null,lockedFare=0,paymentMode='ONLINE'}){if(!client.configured)return demoStore.createBooking({cityCode,serviceCode,bookingMode,scheduledAt,goodsDescription,pickupAddress,dropAddress,vehicleClass,lockedFare,paymentMode});const user=await currentUser();if(!user?.id)throw new Error('login_required');const rows=await client.insert('bookings',{customer_id:user.id,city_code:cityCode,service_code:serviceCode,status:'SEARCHING',booking_mode:bookingMode,scheduled_at:isoOrNull(scheduledAt),goods_description:goodsDescription,pickup_address:pickupAddress,drop_address:dropAddress,vehicle_class:vehicleClass,fare_locked:true,locked_fare:lockedFare,customer_payment_mode:paymentMode});return Array.isArray(rows)?rows[0]:rows},
  async myBookings(){if(!client.configured)return demoStore.myBookings();const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{customer_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerBookings(){if(!client.configured)return demoStore.partnerBookings();const user=await currentUser();if(!user?.id)return [];return client.select('bookings',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:50})},
  async partnerOffers(){if(!client.configured)return demoStore.partnerOffers();const user=await currentUser();if(!user?.id)return [];const rows=await client.rpc('get_my_dispatch_offers');return (rows||[]).map(normalizeDispatchOffer)},
  async setPartnerOnline(online,{latitude=null,longitude=null,heading=null}={}){if(!client.configured)return demoStore.setPartnerOnline(online);return client.rpc('set_partner_availability',{p_online:Boolean(online),p_latitude:latitude,p_longitude:longitude,p_heading:heading})},
  async acceptPartnerOffer(offerRef){if(!client.configured)return demoStore.acceptOffer(demoBookingIdFromOfferRef(offerRef));return client.rpc('respond_to_dispatch_offer',{p_offer_id:offerRef,p_response:'ACCEPTED'})},
  async declinePartnerOffer(offerRef){if(!client.configured)return demoStore.declineOffer(demoBookingIdFromOfferRef(offerRef));return client.rpc('respond_to_dispatch_offer',{p_offer_id:offerRef,p_response:'DECLINED'})},
  async setBookingStatus(bookingId,status){if(!client.configured)return demoStore.setBookingStatus(bookingId,status);return secureApi(`/partner/bookings/${bookingId}/status`,{method:'POST',body:JSON.stringify({status})})},
  async cancelBooking(bookingId,reason){if(!client.configured)return demoStore.cancelBooking(bookingId,reason);return secureApi(`/customer/bookings/${bookingId}/cancel`,{method:'POST',body:JSON.stringify({reason})})},
  async addTripProof(bookingId,type,note=''){if(!client.configured)return demoStore.addProof(bookingId,type,note);return secureApi(`/partner/bookings/${bookingId}/proof`,{method:'POST',body:JSON.stringify({type,note})})},
  async tripProofs(bookingId){if(!client.configured)return demoStore.proofsForBooking(bookingId);return secureApi(`/bookings/${bookingId}/proofs`)},
  async tripEvents(bookingId){if(!client.configured)return demoStore.tripEvents(bookingId);return secureApi(`/bookings/${bookingId}/events`)},
  async createSupportCase(input){if(!client.configured)return demoStore.createSupportCase(input);return secureApi('/support/cases',{method:'POST',body:JSON.stringify(input)})},
  async supportCases(){if(!client.configured)return demoStore.supportCases();return secureApi('/support/cases')},
  async resolveSupportCase(caseId){if(!client.configured)return demoStore.resolveSupportCase(caseId);return secureApi(`/admin/support/${caseId}/resolve`,{method:'POST'})},
  async partnerEarnings(){if(!client.configured)return demoStore.partnerEarnings();const user=await currentUser();if(!user?.id)return [];return client.select('partner_finance_ledger',{filters:{partner_id:eq(user.id)},order:desc('created_at'),limit:100})},
  async adminSnapshot(){if(!client.configured)return demoStore.adminSnapshot();return secureApi('/dashboard')},
  async fleetSnapshot(){if(!client.configured)return demoStore.fleetSnapshot();return secureApi('/fleet/me')},
  resetDemo(){if(client.configured)throw new Error('not_demo_mode');return demoStore.reset()},
  subscribe(handler){if(typeof globalThis.addEventListener!=='function')return()=>{};const fn=(event)=>{if(!client.configured&&event.key==='loadin.demo.v1')handler?.()};globalThis.addEventListener('storage',fn);return()=>globalThis.removeEventListener('storage',fn)}
};