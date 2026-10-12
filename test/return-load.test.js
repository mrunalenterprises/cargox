import test from 'node:test';
import assert from 'node:assert/strict';
import { returnLoadMatchScore, calculateReturnLoadDiscount, returnLoadPartnerEconomics } from '../src/domain/return-load.js';

const pune = { lat: 18.5204, lng: 73.8567 };
const pimpri = { lat: 18.6298, lng: 73.7997 };
const wakad = { lat: 18.5975, lng: 73.7898 };
const hinjewadi = { lat: 18.5912, lng: 73.7389 };
const satara = { lat: 17.6805, lng: 74.0183 };

test('good return route produces eligible match', () => {
  const r = returnLoadMatchScore({
    partnerDestination: pimpri,
    partnerReturnTarget: hinjewadi,
    bookingPickup: wakad,
    bookingDrop: hinjewadi,
    partnerQualityScore: 92,
  });
  assert.equal(r.eligible, true);
  assert.ok(r.score >= 55);
});

test('excessive detour is rejected', () => {
  const r = returnLoadMatchScore({
    partnerDestination: pune,
    partnerReturnTarget: pimpri,
    bookingPickup: satara,
    bookingDrop: pune,
  });
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'EXCESSIVE_DETOUR');
});

test('vehicle mismatch is rejected', () => {
  const r = returnLoadMatchScore({
    partnerDestination: pimpri,
    partnerReturnTarget: hinjewadi,
    bookingPickup: wakad,
    bookingDrop: hinjewadi,
    vehicleCompatible: false,
  });
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'INCOMPATIBLE_SERVICE_OR_VEHICLE');
});

test('high score receives return load discount up to 15 percent', () => {
  const d = calculateReturnLoadDiscount({ baseFare: 1000, matchScore: 100 });
  assert.equal(d.discountPct, 15);
  assert.equal(d.customerFare, 850);
});

test('ineligible score gives no discount', () => {
  const d = calculateReturnLoadDiscount({ baseFare: 1000, matchScore: 40 });
  assert.equal(d.discountPct, 0);
  assert.equal(d.customerFare, 1000);
});

test('commission partner keeps 85 percent of discounted fare', () => {
  const e = returnLoadPartnerEconomics({ customerFare: 850, partnerPlan: 'commission' });
  assert.equal(e.platformCommission, 127.5);
  assert.equal(e.partnerEarning, 722.5);
});

test('subscription partner receives full discounted fare directly', () => {
  const e = returnLoadPartnerEconomics({ customerFare: 850, partnerPlan: 'subscription' });
  assert.equal(e.platformCommission, 0);
  assert.equal(e.partnerEarning, 850);
  assert.equal(e.settlementMode, 'DIRECT_TO_PARTNER');
});
