export const CUSTOMER_RELIABILITY_LEVEL = Object.freeze({
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  WATCH: 'WATCH',
  RESTRICTED: 'RESTRICTED'
});

export const BOOKING_RESTRICTION = Object.freeze({
  NONE: 'NONE',
  PREPAID_ONLY: 'PREPAID_ONLY',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  BLOCKED: 'BLOCKED'
});

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function calculateCustomerReliability({
  completedTrips = 0,
  customerCancellations = 0,
  postAssignmentCancellations = 0,
  noShows = 0,
  paymentFailures = 0,
  disputesLost = 0,
  fraudFlags = 0,
  onTimePickupPresencePct = 100,
  successfulPaymentPct = 100
} = {}) {
  const volumeBonus = Math.min(12, completedTrips * 0.4);
  const score = clamp(
    78 + volumeBonus
      + (clamp(onTimePickupPresencePct) - 80) * 0.12
      + (clamp(successfulPaymentPct) - 80) * 0.16
      - customerCancellations * 1.5
      - postAssignmentCancellations * 4
      - noShows * 10
      - paymentFailures * 5
      - disputesLost * 7
      - fraudFlags * 18
  );

  let level = CUSTOMER_RELIABILITY_LEVEL.RESTRICTED;
  if (score >= 88) level = CUSTOMER_RELIABILITY_LEVEL.EXCELLENT;
  else if (score >= 72) level = CUSTOMER_RELIABILITY_LEVEL.GOOD;
  else if (score >= 50) level = CUSTOMER_RELIABILITY_LEVEL.WATCH;

  return { score: Number(score.toFixed(2)), level };
}

export function determineBookingRestriction({
  reliabilityScore,
  noShowsLast30Days = 0,
  postAssignmentCancellationsLast30Days = 0,
  unpaidDues = 0,
  criticalFraudFlag = false,
  accountSuspended = false
} = {}) {
  if (accountSuspended || criticalFraudFlag) {
    return { restriction: BOOKING_RESTRICTION.BLOCKED, reason: 'SAFETY_OR_FRAUD_REVIEW' };
  }
  if (unpaidDues > 0 || noShowsLast30Days >= 2 || reliabilityScore < 40) {
    return { restriction: BOOKING_RESTRICTION.PREPAID_ONLY, reason: 'PAYMENT_OR_RELIABILITY_RISK' };
  }
  if (postAssignmentCancellationsLast30Days >= 3 || reliabilityScore < 55) {
    return { restriction: BOOKING_RESTRICTION.MANUAL_REVIEW, reason: 'REPEATED_LATE_CANCELLATION' };
  }
  return { restriction: BOOKING_RESTRICTION.NONE, reason: null };
}

export function evaluateCancellationImpact({
  stage,
  cancelledBy,
  verifiedEmergency = false,
  partnerFault = false,
  platformFault = false
} = {}) {
  if (cancelledBy !== 'CUSTOMER' || verifiedEmergency || partnerFault || platformFault) {
    return { reliabilityPenalty: 0, cancellationFeeEligible: false };
  }

  if (stage === 'BEFORE_ASSIGNMENT') return { reliabilityPenalty: 0.5, cancellationFeeEligible: false };
  if (stage === 'AFTER_ASSIGNMENT') return { reliabilityPenalty: 4, cancellationFeeEligible: true };
  if (stage === 'PARTNER_AT_PICKUP') return { reliabilityPenalty: 8, cancellationFeeEligible: true };
  if (stage === 'NO_SHOW') return { reliabilityPenalty: 12, cancellationFeeEligible: true };

  return { reliabilityPenalty: 1, cancellationFeeEligible: false };
}

export function buildCustomerReliabilitySummary(input = {}) {
  const reliability = calculateCustomerReliability(input);
  const restriction = determineBookingRestriction({
    reliabilityScore: reliability.score,
    noShowsLast30Days: input.noShowsLast30Days,
    postAssignmentCancellationsLast30Days: input.postAssignmentCancellationsLast30Days,
    unpaidDues: input.unpaidDues,
    criticalFraudFlag: input.criticalFraudFlag,
    accountSuspended: input.accountSuspended
  });

  return { ...reliability, ...restriction };
}
