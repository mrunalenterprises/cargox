export const PROMOTION_TYPE = Object.freeze({
  FLAT: 'FLAT',
  PERCENTAGE: 'PERCENTAGE',
  REFERRAL_CREDIT: 'REFERRAL_CREDIT',
  BUSINESS_DISCOUNT: 'BUSINESS_DISCOUNT'
});

export const PROMOTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  DISABLED: 'DISABLED'
});

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function validatePromotion(promo, now = new Date()) {
  if (!promo?.code || !promo?.type) return { valid: false, reason: 'PROMOTION_INVALID' };
  if (promo.status && promo.status !== PROMOTION_STATUS.ACTIVE) return { valid: false, reason: 'PROMOTION_NOT_ACTIVE' };
  if (promo.startsAt && now < new Date(promo.startsAt)) return { valid: false, reason: 'PROMOTION_NOT_STARTED' };
  if (promo.endsAt && now > new Date(promo.endsAt)) return { valid: false, reason: 'PROMOTION_EXPIRED' };
  if (promo.globalRedemptionLimit != null && Number(promo.totalRedemptions || 0) >= Number(promo.globalRedemptionLimit)) {
    return { valid: false, reason: 'GLOBAL_LIMIT_REACHED' };
  }
  return { valid: true };
}

export function evaluatePromotionEligibility({
  promo,
  fare,
  customerRedemptions = 0,
  customerId,
  cityCode,
  serviceCode,
  vehicleType,
  businessAccountId,
  firstBooking = false,
  customerReliabilityLevel = 'GOOD',
  fraudRiskLevel = 'LOW',
  now = new Date()
}) {
  const base = validatePromotion(promo, now);
  if (!base.valid) return base;
  if (fare <= 0) return { valid: false, reason: 'INVALID_FARE' };
  if (promo.minimumFare != null && fare < Number(promo.minimumFare)) return { valid: false, reason: 'MINIMUM_FARE_NOT_MET' };
  if (promo.perCustomerLimit != null && customerRedemptions >= Number(promo.perCustomerLimit)) return { valid: false, reason: 'CUSTOMER_LIMIT_REACHED' };
  if (promo.firstBookingOnly && !firstBooking) return { valid: false, reason: 'FIRST_BOOKING_ONLY' };
  if (promo.customerId && promo.customerId !== customerId) return { valid: false, reason: 'CUSTOMER_NOT_ELIGIBLE' };
  if (promo.businessAccountId && promo.businessAccountId !== businessAccountId) return { valid: false, reason: 'BUSINESS_NOT_ELIGIBLE' };
  if (promo.cityCodes?.length && !promo.cityCodes.includes(cityCode)) return { valid: false, reason: 'CITY_NOT_ELIGIBLE' };
  if (promo.serviceCodes?.length && !promo.serviceCodes.includes(serviceCode)) return { valid: false, reason: 'SERVICE_NOT_ELIGIBLE' };
  if (promo.vehicleTypes?.length && !promo.vehicleTypes.includes(vehicleType)) return { valid: false, reason: 'VEHICLE_NOT_ELIGIBLE' };
  if (['RESTRICTED'].includes(customerReliabilityLevel)) return { valid: false, reason: 'CUSTOMER_RESTRICTED' };
  if (['HIGH', 'CRITICAL'].includes(fraudRiskLevel)) return { valid: false, reason: 'FRAUD_REVIEW_REQUIRED' };
  return { valid: true };
}

export function calculatePromotionDiscount({ promo, fare }) {
  const amount = Number(fare || 0);
  if (amount <= 0) return { discount: 0, finalFare: 0 };

  let discount = 0;
  if ([PROMOTION_TYPE.FLAT, PROMOTION_TYPE.REFERRAL_CREDIT].includes(promo.type)) {
    discount = Number(promo.value || 0);
  } else if ([PROMOTION_TYPE.PERCENTAGE, PROMOTION_TYPE.BUSINESS_DISCOUNT].includes(promo.type)) {
    discount = amount * (Number(promo.value || 0) / 100);
  }

  if (promo.maxDiscount != null) discount = Math.min(discount, Number(promo.maxDiscount));
  discount = Math.max(0, Math.min(discount, amount));

  return {
    discount: round2(discount),
    finalFare: round2(amount - discount)
  };
}

export function applyPromotion({ promo, fare, eligibility }) {
  if (!eligibility?.valid) {
    return { applied: false, discount: 0, finalFare: round2(fare), reason: eligibility?.reason || 'NOT_ELIGIBLE' };
  }
  const result = calculatePromotionDiscount({ promo, fare });
  return { applied: result.discount > 0, ...result, reason: result.discount > 0 ? null : 'ZERO_DISCOUNT' };
}

export function calculateBusinessDiscount({ fare, discountPct = 0, maxDiscount = null }) {
  const safePct = Math.max(0, Math.min(Number(discountPct || 0), 50));
  let discount = Number(fare || 0) * safePct / 100;
  if (maxDiscount != null) discount = Math.min(discount, Number(maxDiscount));
  discount = Math.max(0, Math.min(discount, Number(fare || 0)));
  return { discount: round2(discount), finalFare: round2(Number(fare || 0) - discount) };
}

export function referralRewardEligibility({
  referrerId,
  referredCustomerId,
  completedPaidTrips = 0,
  selfReferral = false,
  sameDevice = false,
  samePaymentInstrument = false,
  fraudRiskLevel = 'LOW'
}) {
  if (!referrerId || !referredCustomerId) return { eligible: false, reason: 'MISSING_PARTY' };
  if (selfReferral || referrerId === referredCustomerId) return { eligible: false, reason: 'SELF_REFERRAL' };
  if (sameDevice) return { eligible: false, reason: 'SAME_DEVICE' };
  if (samePaymentInstrument) return { eligible: false, reason: 'SAME_PAYMENT_INSTRUMENT' };
  if (['HIGH', 'CRITICAL'].includes(fraudRiskLevel)) return { eligible: false, reason: 'FRAUD_REVIEW_REQUIRED' };
  if (completedPaidTrips < 1) return { eligible: false, reason: 'QUALIFYING_TRIP_REQUIRED' };
  return { eligible: true };
}

export function promotionStackingDecision({ couponApplied, referralCreditApplied, businessDiscountApplied }) {
  const appliedCount = [couponApplied, referralCreditApplied, businessDiscountApplied].filter(Boolean).length;
  if (appliedCount <= 1) return { allowed: true, maxApplications: 1 };
  return { allowed: false, reason: 'PROMOTION_STACKING_NOT_ALLOWED', maxApplications: 1 };
}
