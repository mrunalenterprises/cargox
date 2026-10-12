export function waitingCharge({ arrivedAt, departedAt, freeMinutes = 10, ratePerMinute = 3 }) {
  const start = new Date(arrivedAt).getTime();
  const end = new Date(departedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { waitedMinutes: 0, chargeableMinutes: 0, amount: 0 };
  }
  const waitedMinutes = Math.floor((end - start) / 60000);
  const chargeableMinutes = Math.max(0, waitedMinutes - freeMinutes);
  return {
    waitedMinutes,
    chargeableMinutes,
    amount: Math.round(chargeableMinutes * ratePerMinute),
  };
}

export function noShowDecision({ waitedMinutes, freeMinutes = 10, graceMinutes = 5, customerContactAttempts = 0 }) {
  const threshold = freeMinutes + graceMinutes;
  const eligible = waitedMinutes >= threshold && customerContactAttempts >= 2;
  return {
    eligible,
    reason: eligible ? 'NO_SHOW_ELIGIBLE' : 'WAIT_OR_CONTACT_CUSTOMER',
    thresholdMinutes: threshold,
  };
}

export const EXTRA_CHARGE_TYPES = Object.freeze([
  'WAITING',
  'TOLL',
  'PARKING',
  'HELPER',
  'NIGHT',
  'ROUTE_CHANGE',
  'OTHER',
]);

export function aiPriceGuard({ type, requestedAmount, expectedAmount = 0, tolerancePct = 20, hardCap = null }) {
  if (!EXTRA_CHARGE_TYPES.includes(type)) {
    return { status: 'BLOCK', reason: 'UNSUPPORTED_CHARGE_TYPE', variancePct: null };
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
    return { status: 'BLOCK', reason: 'INVALID_AMOUNT', variancePct: null };
  }
  if (hardCap != null && requestedAmount > hardCap) {
    return { status: 'BLOCK', reason: 'ABOVE_HARD_CAP', variancePct: null };
  }
  if (expectedAmount <= 0) {
    return { status: 'REVIEW', reason: 'NO_REFERENCE_PRICE', variancePct: null };
  }

  const variancePct = ((requestedAmount - expectedAmount) / expectedAmount) * 100;
  if (variancePct <= tolerancePct) {
    return { status: 'ALLOW', reason: 'WITHIN_EXPECTED_RANGE', variancePct: Math.round(variancePct * 10) / 10 };
  }
  if (variancePct <= tolerancePct * 2) {
    return { status: 'WARN', reason: 'ABOVE_EXPECTED_RANGE', variancePct: Math.round(variancePct * 10) / 10 };
  }
  return { status: 'REVIEW', reason: 'SIGNIFICANT_PRICE_VARIANCE', variancePct: Math.round(variancePct * 10) / 10 };
}

export function extraChargeApproval({ type, requestedAmount, guardResult, customerApproved = false, evidenceProvided = false }) {
  if (guardResult.status === 'BLOCK') {
    return { approved: false, state: 'BLOCKED' };
  }
  const autoEligible = type === 'WAITING' && guardResult.status === 'ALLOW';
  if (autoEligible) {
    return { approved: true, state: 'AUTO_APPROVED' };
  }
  if (!customerApproved) {
    return { approved: false, state: 'PENDING_CUSTOMER_APPROVAL' };
  }
  if (['TOLL', 'PARKING', 'OTHER'].includes(type) && !evidenceProvided) {
    return { approved: false, state: 'EVIDENCE_REQUIRED' };
  }
  if (guardResult.status === 'REVIEW') {
    return { approved: false, state: 'MANUAL_REVIEW_REQUIRED' };
  }
  return { approved: true, state: 'CUSTOMER_APPROVED' };
}

export function cancellationOutcome({ actor, fault, tripStarted = false }) {
  if (tripStarted) return { allowed: false, code: 'USE_TRIP_TERMINATION_FLOW' };
  if (fault === 'PARTNER') return { allowed: true, code: 'NO_CUSTOMER_PENALTY' };
  if (fault === 'CUSTOMER' && actor === 'customer') return { allowed: true, code: 'CUSTOMER_CANCELLATION_RULES_APPLY' };
  return { allowed: true, code: 'NEUTRAL_CANCELLATION' };
}
