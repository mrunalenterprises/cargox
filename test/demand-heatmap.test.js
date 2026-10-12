import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMAND_LEVEL,
  HOTSPOT_ACTION,
  buildPartnerPositioningAlert,
  calculateSupplyDemandScore,
  demandLevelFromScore,
  estimatePartnerShortage,
  heatmapCell,
  predictHotspot,
  rankDemandZones,
} from '../src/domain/demand-heatmap.js';

test('high demand and low supply produces a high score', () => {
  const score = calculateSupplyDemandScore({
    openBookings: 10,
    scheduledNext60Min: 8,
    recentSearches: 20,
    onlinePartners: 3,
    availablePartners: 2,
    avgPickupEtaMin: 18,
    cancellationRatePct: 8,
  });
  assert.ok(score >= 75);
});

test('healthy supply reduces demand score', () => {
  const score = calculateSupplyDemandScore({
    openBookings: 2,
    scheduledNext60Min: 1,
    recentSearches: 4,
    onlinePartners: 12,
    availablePartners: 10,
    avgPickupEtaMin: 5,
    cancellationRatePct: 2,
  });
  assert.ok(score < 60);
});

test('demand level thresholds map correctly', () => {
  assert.equal(demandLevelFromScore(92), DEMAND_LEVEL.SURGE_RISK);
  assert.equal(demandLevelFromScore(77), DEMAND_LEVEL.VERY_HIGH);
  assert.equal(demandLevelFromScore(63), DEMAND_LEVEL.HIGH);
  assert.equal(demandLevelFromScore(40), DEMAND_LEVEL.NORMAL);
  assert.equal(demandLevelFromScore(20), DEMAND_LEVEL.LOW);
});

test('partner shortage is estimated from weighted demand', () => {
  const shortage = estimatePartnerShortage({
    openBookings: 8,
    scheduledNext60Min: 4,
    availablePartners: 3,
    targetBookingsPerPartner: 1.2,
  });
  assert.ok(shortage > 0);
});

test('hotspot prediction recommends urgent positioning for severe imbalance', () => {
  const result = predictHotspot({
    currentScore: 91,
    previousScore: 72,
    openBookings: 14,
    availablePartners: 2,
    scheduledNext60Min: 5,
  });
  assert.equal(result.action, HOTSPOT_ACTION.URGENT_POSITIONING);
  assert.equal(result.isHotspot, true);
});

test('positioning alert only builds for high demand zones', () => {
  const low = buildPartnerPositioningAlert({ zoneName: 'A', serviceName: 'Loading Vehicle', score: 40 });
  const high = buildPartnerPositioningAlert({
    zoneName: 'B',
    serviceName: 'Loading Vehicle',
    score: 82,
    estimatedExtraTrips: 3,
    distanceToZoneKm: 2.4,
  });
  assert.equal(low, null);
  assert.equal(high.type, 'HIGH_DEMAND_POSITIONING');
  assert.equal(high.estimatedExtraTrips, 3);
});

test('zone ranking prefers stronger demand and heatmap cell exposes hotspot metadata', () => {
  const zones = rankDemandZones([
    { id: 'z1', openBookings: 2, scheduledNext60Min: 0, recentSearches: 2, onlinePartners: 8, availablePartners: 7, avgPickupEtaMin: 4, cancellationRatePct: 1 },
    { id: 'z2', openBookings: 9, scheduledNext60Min: 4, recentSearches: 15, onlinePartners: 3, availablePartners: 2, avgPickupEtaMin: 16, cancellationRatePct: 7 },
  ]);
  assert.equal(zones[0].id, 'z2');

  const cell = heatmapCell({
    cityId: 'c1',
    zoneId: 'z2',
    serviceCode: 'LOADING_VEHICLE',
    lat: 19.88,
    lng: 75.34,
    previousScore: 60,
    metrics: zones[0],
  });
  assert.equal(cell.zoneId, 'z2');
  assert.ok(cell.demandScore >= 60);
  assert.ok(cell.partnerShortage >= 0);
});
