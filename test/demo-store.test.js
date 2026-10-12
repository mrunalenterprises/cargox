import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoStore } from '../apps/shared/demo-store.js';

test('demo flow shares customer booking with partner, admin and fleet',()=>{
  const store=createDemoStore({storage:null});
  store.reset();
  const booking=store.createBooking({serviceCode:'LOADING_VEHICLE',goodsDescription:'10 cartons',pickupAddress:'Cidco',dropAddress:'Waluj',vehicleClass:'TATA_ACE',lockedFare:600,paymentMode:'CASH'});
  assert.equal(booking.status,'SEARCHING');
  assert.equal(store.myBookings()[0].id,booking.id);
  const offer=store.partnerOffers().find(x=>x.booking_id===booking.id);
  assert.ok(offer);
  assert.equal(offer.booking.pickup_address,'Cidco');
  const accepted=store.acceptOffer(booking.id);
  assert.equal(accepted.status,'ASSIGNED');
  assert.equal(store.partnerBookings().some(x=>x.id===booking.id),true);
  const admin=store.adminSnapshot();
  assert.equal(admin.bookings.some(x=>x.id===booking.id&&x.status==='ASSIGNED'),true);
  const fleet=store.fleetSnapshot();
  assert.equal(fleet.bookings.some(x=>x.id===booking.id),true);
});

test('demo trip completion updates finance snapshots',()=>{
  const store=createDemoStore({storage:null});
  store.reset();
  const booking=store.createBooking({serviceCode:'PARCEL_2W',goodsDescription:'Document',pickupAddress:'A',dropAddress:'B',vehicleClass:'BIKE',lockedFare:200});
  store.acceptOffer(booking.id);
  store.setBookingStatus(booking.id,'IN_PROGRESS');
  const completed=store.setBookingStatus(booking.id,'COMPLETED');
  assert.equal(completed.status,'COMPLETED');
  const admin=store.adminSnapshot();
  assert.equal(admin.metrics.completed>=1,true);
  assert.equal(admin.metrics.netRevenue>=30,true);
  const fleet=store.fleetSnapshot();
  assert.equal(fleet.bookings.find(x=>x.id===booking.id).status,'COMPLETED');
});

test('demo partner online state appears in admin and fleet',()=>{
  const store=createDemoStore({storage:null});
  store.reset();
  store.setPartnerOnline(true);
  assert.equal(store.adminSnapshot().metrics.onlinePartners,1);
  assert.equal(store.fleetSnapshot().drivers[0].status,'ONLINE');
});
