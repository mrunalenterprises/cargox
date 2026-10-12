export const DEMAND_LEVEL = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH',
  SURGE_RISK: 'SURGE_RISK',
});

export const PRICING_DECISION = Object.freeze({
  BASE: 'BASE',
  ADJUSTED: 'ADJUSTED',
  CAPPED: 'CAPPED',
  BLOCKED: 'BLOCKED',
});

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function validatePricingConfig(config = {}) {
  const {
    minMultiplier = 1,
    maxMultiplier = 1.25,
    maxFareIncreasePct = 25,
    allowDemandPricing = true,
  } = config;

  if (minMultiplier <= 0) throw new Error('minMultiplier must be greater than 0');
  if (maxMultiplier < minMultiplier) throw new Error('maxMultiplier must be >= minMultiplier');
  if (maxFareIncreasePct < 0 || maxFareIncreasePct > 100) {
    throw new Error('maxFareIncreasePct must be between 0 and 100');
  }

  return { minMultiplier, maxMultiplier, maxFareIncreasePct, allowDemandPricing };
}

export function suggestedDemandMultiplier({
  demandLevel = DEMAND_LEVEL.NORMAL,
  demandScore = 50,
  supplyGap = 0,
  avgPickupEtaMin = 8,
} = {}) {
  const levelBase = {
    [DEMAND_LEVEL.LOW]: 0.95,
    [DEMAND_LEVEL.NORMAL]: 1,
    [DEMAND_LEVEL.HIGH]: 1.08,
    [DEMAND_LEVEL.VERY_HIGH]: 1.15,
    [DEMAND_LEVEL.SURGE_RISK]: 1.2,
  }[demandLevel] ?? 1;

  const demandPressure = clamp((Number(demandScore) - 50) / 500, -0.08, 0.1);
  const supplyPressure = clamp(Number(supplyGap) / 100, 0, 0.08);
  const etaPressure = clamp((Number(avgPickupEtaMin) - 8) / 100, 0, 0.05);

  return roundMoney(clamp(levelBase + demandPressure + supplyPressure + etaPressure, 0.9, 1.3));
}

export function calculateDynamicFare({
  baseFare,
  demandLevel = DEMAND_LEVEL.NORMAL,
  demandScore = 50,
  supplyGap = 0,
  avgPickupEtaMin = 8,
  pricingConfig = {},
  adminMultiplier = null,
  absoluteMaxFare = null,
} = {}) {
  if (!(Number(baseFare) > 0)) throw new Error('baseFare must be greater than 0');

  const config = validatePricingConfig(pricingConfig);
  const suggested = config.allowDemandPricing
    ? suggestedDemandMultiplier({ demandLevel, demandScore, supplyGap, avgPickupEtaMin })
    : 1;

  const requestedMultiplier = adminMultiplier == null ? suggested : Number(adminMultiplier);
  if (!(requestedMultiplier > 0)) throw new Error('adminMultiplier must be greater than 0');

  const multiplier = clamp(requestedMultiplier, config.minMultiplier, config.maxMultiplier);
  const pctCapFare = Number(baseFare) * (1 + config.maxFareIncreasePct / 100);
  const hardCap = absoluteMaxFare == null ? Infinity : Number(absoluteMaxFare);
  const maxAllowedFare = Math.min(pctCapFare, hardCap);

  const rawFare = Number(baseFare) * multiplier;
  const finalFare = roundMoney(Math.min(rawFare, maxAllowedFare));
  const effectiveMultiplier = roundMoney(finalFare / Number(baseFare));
  const capped = finalFare < roundMoney(rawFare);

  return {
    baseFare: roundMoney(baseFare),
    suggestedMultiplier: suggested,
    requestedMultiplier: roundMoney(requestedMultiplier),
    appliedMultiplier: effectiveMultiplier,
    finalFare,
    maxAllowedFare: Number.isFinite(maxAllowedFare) ? roundMoney(maxAllowedFare) : null,
    increaseAmount: roundMoney(finalFare - Number(baseFare)),
    increasePct: roundMoney(((finalFare - Number(baseFare)) / Number(baseFare)) * 100),
    fareLocked: true,
    decision: capped ? PRICING_DECISION.CAPPED : effectiveMultiplier === 1 ? PRICING_DECISION.BASE : PRICING_DECISION.ADJUSTED,
  };
}

export function enforceFareLock({ lockedFare, proposedFinalFare, approvedExtras = 0 } = {}) {
  if (!(Number(lockedFare) >= 0)) throw new Error('lockedFare is required');
  if (!(Number(proposedFinalFare) >= 0)) throw new Error('proposedFinalFare is required');

  const maxChargeable = roundMoney(Number(lockedFare) + Number(approvedExtras || 0));
  const proposed = roundMoney(proposedFinalFare);
  return {
    allowed: proposed <= maxChargeable,
    maxChargeable,
    proposedFinalFare: proposed,
    excessAmount: roundMoney(Math.max(0, proposed - maxChargeable)),
  };
}

export function adminPricingGuard({
  multiplier,
  minMultiplier = 0.9,
  maxMultiplier = 1.25,
  requiresReasonAbove = 1.15,
  reason = '',
} = {}) {
  const value = Number(multiplier);
  if (!(value > 0)) return { allowed: false, reason: 'INVALID_MULTIPLIER' };
  if (value < minMultiplier || value > maxMultiplier) {
    return { allowed: false, reason: 'OUTSIDE_ADMIN_GUARDRAIL' };
  }
  if (value > requiresReasonAbove && !String(reason).trim()) {
    return { allowed: false, reason: 'REASON_REQUIRED' };
  }
  return { allowed: true, reason: 'OK' };
}
