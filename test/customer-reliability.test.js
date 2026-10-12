import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_RESTRICTION,
  CUSTOMER_RELIABILITY_LEVEL,
  buildCustomerReliabilitySummary,
  calculateCustomerReliability,
  determineBookingRestriction,
  evaluateCancellationImpact
} from '../src/domain/customer-reliability.js';

test('reliable repeat customer scores excellent', () => {
  const result = calculateCustomerReliability({
    completedTrips: 30,
    customerCancellations: 1,
    onTimePickupPresencePct: 98,
    successfulPaymentPct: 100
  });
  assert.equal(result.level, CUSTOMER_RELIABILITY_LEVEL.EXCELLENT);
  assert.ok(result.score >= 88);
});

test('repeated no-shows sharply reduce reliability', () => {
  const result = calculateCustomerReliability({ completedTrips: 4, noShows: 3 });
  assert.ok(result.score < 60);
});

test('two recent no-shows force prepaid-only', () => {
  const result = determineBookingRestriction({ reliabilityScore: 70, noShowsLast30Days: 2 });
  assert.equal(result.restriction, BOOKING_RESTRICTION.PREPAID_ONLY);
});

test('critical fraud blocks booking', () => {
  const result = determineBookingRestriction({ reliabilityScore: 95, criticalFraudFlag: true });
  assert.equal(result.restriction, BOOKING_RESTRICTION.BLOCKED);
});

test('partner fault cancellation has zero customer penalty', () => {
  const result = evaluateCancellationImpact({
    stage: 'AFTER_ASSIGNMENT',
    cancelledBy: 'CUSTOMER',
    partnerFault: true
  });
  assert.deepEqual(result, { reliabilityPenalty: 0, cancellationFeeEligible: false });
});

test('customer no-show has strongest standard penalty', () => {
  const result = evaluateCancellationImpact({ stage: 'NO_SHOW', cancelledBy: 'CUSTOMER' });
  assert.equal(result.reliabilityPenalty, 12);
  assert.equal(result.cancellationFeeEligible, true);
});

test('summary combines score and active booking rule', () => {
  const result = buildCustomerReliabilitySummary({
    completedTrips: 2,
    noShows: 2,
    noShowsLast30Days: 2
  });
  assert.equal(result.restriction, BOOKING_RESTRICTION.PREPAID_ONLY);
  assert.ok(typeof result.score === 'number');
});
