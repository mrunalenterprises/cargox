import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoStore } from '../apps/shared/demo-store.js';

test('demo trip runs customer to partner to proof-backed completion',()=>{
  const store=createDemoStore({storage:null});
  const booking=store.createBooking({serviceCode:'LOADING_VEHICLE',goodsDescription:'10 boxes',pickupAddress:'A',dropAddress:'B',vehicleClass:'TATA_ACE',lockedFare:1000});
  assert.equal(booking.status,'SEARCHING');
  assert.equal(store.partnerOffers().length,1);
  store.setPartnerOnline(true);
  store.acceptOffer(booking.id);
  assert.equal(store.partnerBookings().find(x=>x.id===booking.id).status,'ASSIGNED');
  store.setBookingStatus(booking.id,'PARTNER_ARRIVING');
  store.setBookingStatus(booking.id,'AT_PICKUP');
  store.addProof(booking.id,'PICKUP_PHOTO','pickup evidence');
  store.setBookingStatus(booking.id,'IN_PROGRESS');
  store.addProof(booking.id,'DELIVERY_PHOTO','delivery evidence');
  store.setBookingStatus(booking.id,'COMPLETED');
  const completed=store.partnerBookings().find(x=>x.id===booking.id);
  assert.equal(completed.status,'COMPLETED');
  assert.equal(store.proofsForBooking(booking.id).length,2);
  const earning=store.partnerEarnings().find(x=>x.booking_id===booking.id);
  assert.equal(earning.gross,1000);
  assert.equal(earning.commission,150);
  assert.equal(earning.amount,850);
});

test('customer support P0 appears in admin and can resolve',()=>{
  const store=createDemoStore({storage:null});
  const booking=store.createBooking({serviceCode:'PARCEL_2W',pickupAddress:'A',dropAddress:'B',lockedFare:200});
  const support=store.createSupportCase({bookingId:booking.id,category:'SAFETY',priority:'P0',message:'SOS'});
  assert.equal(support.owner,'SAFETY');
  assert.equal(store.adminSnapshot().metrics.openSupport,1);
  store.resolveSupportCase(support.id);
  assert.equal(store.supportCases()[0].status,'RESOLVED');
  assert.equal(store.adminSnapshot().metrics.openSupport,0);
});

test('customer cancellation removes active booking from admin operations',()=>{
  const store=createDemoStore({storage:null});
  const booking=store.createBooking({serviceCode:'HELPER',pickupAddress:'A',dropAddress:'B',lockedFare:300});
  assert.equal(store.adminSnapshot().metrics.active,1);
  store.cancelBooking(booking.id,'changed mind');
  assert.equal(store.myBookings().find(x=>x.id===booking.id).status,'CANCELLED');
  assert.equal(store.adminSnapshot().metrics.active,0);
});