import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBreakdownReport,
  buildReplacementRequest,
  replacementFare,
  replacementSettlement,
  handoverChecklist,
  replacementPriority,
} from '../src/domain/trip-guarantee.js';

test('valid breakdown report requires booking partner vehicle progress time and GPS', () => {
  const result = validateBreakdownReport({
    bookingId: 'b1', originalPartnerId: 'p1', vehicleId: 'v1', progressPct: 40,
    reportedAt: '2026-10-12T10:00:00Z', location: { lat: 19.87, lng: 75.34 },
  });
  assert.equal(result.valid, true);
});

test('replacement request never asks customer to rebook', () => {
  const r = buildReplacementRequest({
    bookingId: 'b1', originalPartnerId: 'p1', originalVehicleId: 'v1', progressPct: 40,
    originalFare: 1000, pickup: 'A', drop: 'B', currentLocation: 'C', service: 'LOADING_VEHICLE', vehicleClass: 'TATA_ACE',
  });
  assert.equal(r.customerMustRebook, false);
  assert.equal(r.pickup, 'C');
  assert.equal(r.remainingPct, 60);
});

test('remaining fare is based on unfinished portion', () => {
  assert.equal(replacementFare({ originalFare: 1000, progressPct: 40 }), 600);
});

test('commission replacement settlement follows frozen breakdown rule', () => {
  const s = replacementSettlement({ originalFare: 1000, progressPct: 40, commissionRatePct: 15, replacementPlan: 'COMMISSION' });
  assert.equal(s.originalPartnerPayout, 0);
  assert.equal(s.remainingFare, 600);
  assert.equal(s.platformCommissionOnOriginalBooking, 150);
  assert.equal(s.replacementPartnerEntitlement, 510);
  assert.equal(s.customerAdditionalCharge, 0);
});

test('subscription replacement gets remaining fare without per-trip commission', () => {
  const s = replacementSettlement({ originalFare: 1000, progressPct: 40, commissionRatePct: 15, replacementPlan: 'SUBSCRIPTION' });
  assert.equal(s.replacementCommission, 0);
  assert.equal(s.replacementPartnerEntitlement, 600);
});

test('cargo handover is incomplete until every proof is present', () => {
  const h = handoverChecklist({ pickupProofPresent: true, handoverPhotoPresent: true, handoverOtpVerified: false, gpsCaptured: true, goodsConditionRecorded: true });
  assert.equal(h.complete, false);
  assert.ok(h.missing.includes('handoverOtpVerified'));
});

test('critical replacement priority for stranded critical trip', () => {
  assert.equal(replacementPriority({ activeTrip: true, medicalOrCritical: true, strandedMinutes: 40 }), 'CRITICAL');
});
