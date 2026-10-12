import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMAND_LEVEL,
  PRICING_DECISION,
  adminPricingGuard,
  calculateDynamicFare,
  enforceFareLock,
  suggestedDemandMultiplier,
} from '../src/domain/dynamic-pricing.js';

test('normal demand keeps multiplier close to base', () => {
  const multiplier = suggestedDemandMultiplier({
    demandLevel: DEMAND_LEVEL.NORMAL,
    demandScore: 50,
    supplyGap: 0,
    avgPickupEtaMin: 8,
  });
  assert.equal(multiplier, 1);
});

test('high demand increases fare within configured cap', () => {
  const result = calculateDynamicFare({
    baseFare: 1000,
    demandLevel: DEMAND_LEVEL.VERY_HIGH,
    demandScore: 90,
    supplyGap: 20,
    avgPickupEtaMin: 15,
    pricingConfig: { maxMultiplier: 1.25, maxFareIncreasePct: 25 },
  });
  assert.ok(result.finalFare > 1000);
  assert.ok(result.finalFare <= 1250);
  assert.equal(result.fareLocked, true);
});

test('absolute max fare overrides percentage cap when lower', () => {
  const result = calculateDynamicFare({
    baseFare: 1000,
    adminMultiplier: 1.25,
    pricingConfig: { maxMultiplier: 1.25, maxFareIncreasePct: 25 },
    absoluteMaxFare: 1150,
  });
  assert.equal(result.finalFare, 1150);
  assert.equal(result.decision, PRICING_DECISION.CAPPED);
});

test('disabled demand pricing keeps base fare', () => {
  const result = calculateDynamicFare({
    baseFare: 800,
    demandLevel: DEMAND_LEVEL.SURGE_RISK,
    demandScore: 100,
    supplyGap: 50,
    avgPickupEtaMin: 20,
    pricingConfig: { allowDemandPricing: false, minMultiplier: 1, maxMultiplier: 1.25 },
  });
  assert.equal(result.finalFare, 800);
  assert.equal(result.decision, PRICING_DECISION.BASE);
});

test('fare lock allows only approved extras beyond locked fare', () => {
  const allowed = enforceFareLock({ lockedFare: 1000, proposedFinalFare: 1120, approvedExtras: 120 });
  const blocked = enforceFareLock({ lockedFare: 1000, proposedFinalFare: 1150, approvedExtras: 120 });
  assert.equal(allowed.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.excessAmount, 30);
});

test('admin multiplier outside guardrail is blocked', () => {
  const result = adminPricingGuard({ multiplier: 1.4, maxMultiplier: 1.25 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'OUTSIDE_ADMIN_GUARDRAIL');
});

test('high admin multiplier requires reason', () => {
  const denied = adminPricingGuard({ multiplier: 1.2, requiresReasonAbove: 1.15, reason: '' });
  const allowed = adminPricingGuard({ multiplier: 1.2, requiresReasonAbove: 1.15, reason: 'Heavy demand' });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'REASON_REQUIRED');
  assert.equal(allowed.allowed, true);
});
