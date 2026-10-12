import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFavouritePartner,
  canBookAgain,
  buildBookAgainRequest,
  preferredPartnerMatchScore,
  rankPreferredPartners,
  buildRepeatCustomerSummary,
} from '../src/domain/favourite-partner.js';

test('buildFavouritePartner creates active preference', () => {
  const favourite = buildFavouritePartner({ customerId: 'c1', partnerId: 'p1', serviceType: 'LOADING_VEHICLE' });
  assert.equal(favourite.active, true);
  assert.equal(favourite.partnerId, 'p1');
});

test('book again requires completed trip and active eligible partner', () => {
  const result = canBookAgain({
    previousBooking: { customerId: 'c1', partnerId: 'p1', status: 'COMPLETED' },
    customerId: 'c1',
    partner: { partnerId: 'p1', accountStatus: 'ACTIVE', documentEligible: true, serviceCompatible: true },
  });
  assert.equal(result.eligible, true);
});

test('book again never copies stale fare and requires repricing', () => {
  const request = buildBookAgainRequest({
    customerId: 'c1',
    previousBooking: {
      bookingId: 'b1', customerId: 'c1', partnerId: 'p1', vehicleId: 'v1', status: 'COMPLETED',
      serviceType: 'LOADING_VEHICLE', pickup: { lat: 1, lng: 2 }, drop: { lat: 3, lng: 4 }, fare: 999,
    },
  });
  assert.equal(request.pricingMode, 'REPRICE_REQUIRED');
  assert.equal(request.copyOldFare, false);
  assert.equal('fare' in request, false);
});

test('favourite boost improves eligible partner score', () => {
  const base = preferredPartnerMatchScore({ partnerQualityScore: 80, rating: 4.5, distanceKm: 2 });
  const favourite = preferredPartnerMatchScore({ partnerQualityScore: 80, rating: 4.5, distanceKm: 2, isFavourite: true });
  assert.ok(favourite.score > base.score);
});

test('preference cannot bypass safety block', () => {
  const blocked = preferredPartnerMatchScore({
    isFavourite: true,
    isBookAgain: true,
    partnerQualityScore: 100,
    rating: 5,
    distanceKm: 0,
    activeSafetyBlock: true,
  });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.reason, 'SAFETY_OR_ACCOUNT_BLOCK');
});

test('ranking prefers strong eligible favourite but excludes ineligible candidate', () => {
  const ranked = rankPreferredPartners([
    { partnerId: 'p1', partnerQualityScore: 80, rating: 4.4, distanceKm: 2, isFavourite: true },
    { partnerId: 'p2', partnerQualityScore: 88, rating: 4.7, distanceKm: 1 },
    { partnerId: 'p3', partnerQualityScore: 100, rating: 5, distanceKm: 0, suspended: true },
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].partnerId, 'p1');
});

test('repeat customer summary exposes completed history label', () => {
  const summary = buildRepeatCustomerSummary({ completedTripsTogether: 3, lastCompletedAt: '2026-10-01T10:00:00Z' });
  assert.equal(summary.isRepeatCustomer, true);
  assert.equal(summary.label, '3 completed trips together');
});
