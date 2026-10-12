import test from 'node:test';
import assert from 'node:assert/strict';
import { demoStore } from '../apps/shared/demo-store.js';
import { experienceStore } from '../apps/shared/experience-store.js';

test('partner onboarding progresses and resets',()=>{
  experienceStore.reset();
  let o=experienceStore.onboarding();
  assert.equal(o.completed,2);
  assert.equal(o.percent,25);
  o=experienceStore.completeStep('SELFIE');
  assert.equal(o.completed,3);
  assert.equal(o.steps.find(s=>s.code==='SELFIE').done,true);
  o=experienceStore.resetOnboarding();
  assert.equal(o.completed,2);
});

test('tracking and payment reflect shared demo booking',()=>{
  demoStore.reset();
  const booking=demoStore.createBooking({cityCode:'CSN',serviceCode:'LOADING_VEHICLE',goodsDescription:'Machine parts',pickupAddress:'Cidco',dropAddress:'Waluj',vehicleClass:'TATA_ACE',lockedFare:1000,paymentMode:'CASH'});
  let tracking=experienceStore.tracking();
  assert.equal(tracking.id,booking.id);
  assert.equal(tracking.status,'SEARCHING');
  assert.equal(tracking.progress,12);
  assert.equal(tracking.points.length,4);
  const payment=experienceStore.payment();
  assert.equal(payment.customerTotal,1000);
  assert.equal(payment.platformCommission,150);
  assert.equal(payment.partnerEntitlement,850);
  assert.equal(payment.gatewayFeeChargedToCustomer,0);
});

test('notifications and shifting plan expose customer experience data',()=>{
  const notes=experienceStore.notifications();
  assert.ok(notes.some(n=>n.title==='Fare Lock active'));
  const shifting=experienceStore.shifting();
  assert.equal(shifting.inspectionRequired,true);
  assert.ok(shifting.inventory.length>=4);
  assert.ok(shifting.stages.includes('Delivery Proof'));
});
