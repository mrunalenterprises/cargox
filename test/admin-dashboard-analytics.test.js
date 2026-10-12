import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_LEVEL,
  buildLiveOperationsSummary,
  buildPlatformKpis,
  evaluateOperationsHealth,
  safePercent,
  summarizeCityPerformance,
  summarizeServicePerformance,
} from '../src/domain/admin-dashboard-analytics.js';

test('safePercent handles zero denominator', () => {
  assert.equal(safePercent(5, 0), 0);
  assert.equal(safePercent(5, 10), 50);
});

test('buildPlatformKpis calculates completion and cancellation metrics', () => {
  const result = buildPlatformKpis({
    bookings: [
      { status: 'COMPLETED', fareAmount: 500 },
      { status: 'COMPLETED', fareAmount: 700 },
      { status: 'CANCELLED', fareAmount: 300 },
      { status: 'IN_TRANSIT', fareAmount: 900 },
    ],
    partners: [
      { status: 'ACTIVE', isOnline: true, bookingPriority: 'NORMAL' },
      { status: 'ACTIVE', isOnline: false, bookingPriority: 'LOW' },
    ],
    customers: [
      { restriction: 'NONE' },
      { restriction: 'PREPAID_ONLY' },
    ],
    finance: { platformGrossRevenue: 1000, platformNetRevenue: 800, pendingPartnerPayout: 250 },
    incidents: [{ severity: 'CRITICAL', status: 'OPEN' }],
  });

  assert.equal(result.totalBookings, 4);
  assert.equal(result.completedBookings, 2);
  assert.equal(result.activeBookings, 1);
  assert.equal(result.completionRatePct, 50);
  assert.equal(result.cancellationRatePct, 25);
  assert.equal(result.grossBookingValue, 2400);
  assert.equal(result.onlinePartners, 1);
  assert.equal(result.restrictedPartners, 1);
  assert.equal(result.restrictedCustomers, 1);
  assert.equal(result.openCriticalIncidents, 1);
});

test('summarizeCityPerformance merges city records', () => {
  const result = summarizeCityPerformance([
    { cityId: 'A', bookings: 10, completed: 9, cancelled: 1, grossFare: 1000, activePartners: 5, onlinePartners: 3, avgEtaMinutes: 12 },
    { cityId: 'A', bookings: 10, completed: 8, cancelled: 2, grossFare: 1500, activePartners: 4, onlinePartners: 2, avgEtaMinutes: 18 },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].bookings, 20);
  assert.equal(result[0].completed, 17);
  assert.equal(result[0].completionRatePct, 85);
  assert.equal(result[0].grossFare, 2500);
  assert.equal(result[0].avgEtaMinutes, 15);
});

test('summarizeServicePerformance ranks by booking volume', () => {
  const result = summarizeServicePerformance([
    { serviceCode: 'PARCEL', status: 'COMPLETED', fareAmount: 100 },
    { serviceCode: 'PARCEL', status: 'CANCELLED', fareAmount: 80 },
    { serviceCode: 'LOADING', status: 'COMPLETED', fareAmount: 500 },
  ]);

  assert.equal(result[0].serviceCode, 'PARCEL');
  assert.equal(result[0].bookings, 2);
  assert.equal(result[0].completionRatePct, 50);
});

test('evaluateOperationsHealth returns critical for severe degradation', () => {
  const result = evaluateOperationsHealth({
    completionRatePct: 60,
    cancellationRatePct: 25,
    openCriticalIncidents: 3,
    partnerSupplyRatioPct: 40,
    payoutMismatchCount: 4,
  });

  assert.equal(result.level, HEALTH_LEVEL.CRITICAL);
  assert.ok(result.score < 40);
});

test('evaluateOperationsHealth keeps healthy operations healthy', () => {
  const result = evaluateOperationsHealth({
    completionRatePct: 98,
    cancellationRatePct: 2,
    openCriticalIncidents: 0,
    partnerSupplyRatioPct: 90,
    payoutMismatchCount: 0,
  });

  assert.deepEqual(result, { score: 100, level: HEALTH_LEVEL.HEALTHY });
});

test('buildLiveOperationsSummary flags immediate attention', () => {
  const result = buildLiveOperationsSummary({
    activeTrips: [
      { pickupDelayMinutes: 20, routeDeviation: true },
      { pickupDelayMinutes: 2, routeDeviation: false },
    ],
    unassignedBookings: [{}, {}, {}, {}, {}],
    incidents: [
      { type: 'BREAKDOWN', status: 'OPEN' },
      { type: 'SOS', status: 'OPEN' },
    ],
    supportCases: [{ priority: 'URGENT', status: 'IN_REVIEW' }],
  });

  assert.equal(result.activeTrips, 2);
  assert.equal(result.latePickups, 1);
  assert.equal(result.routeDeviations, 1);
  assert.equal(result.openBreakdowns, 1);
  assert.equal(result.openSafetyIncidents, 1);
  assert.equal(result.urgentSupportCases, 1);
  assert.equal(result.requiresImmediateAttention, true);
});
