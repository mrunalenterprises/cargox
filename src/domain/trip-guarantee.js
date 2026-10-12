export const INCIDENT_TYPE = Object.freeze({
  BREAKDOWN: 'BREAKDOWN',
  PARTNER_CANCELLED: 'PARTNER_CANCELLED',
  ACCIDENT: 'ACCIDENT',
  VEHICLE_UNAVAILABLE: 'VEHICLE_UNAVAILABLE',
  OTHER: 'OTHER',
});

export const REPLACEMENT_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  SEARCHING: 'SEARCHING',
  ASSIGNED: 'ASSIGNED',
  HANDOVER_PENDING: 'HANDOVER_PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function validateBreakdownReport(report = {}) {
  const errors = [];
  if (!report.bookingId) errors.push('bookingId_required');
  if (!report.originalPartnerId) errors.push('originalPartnerId_required');
  if (!report.vehicleId) errors.push('vehicleId_required');
  if (!Number.isFinite(Number(report.progressPct)) || Number(report.progressPct) < 0 || Number(report.progressPct) > 100) {
    errors.push('progressPct_invalid');
  }
  if (!report.reportedAt) errors.push('reportedAt_required');
  if (!report.location || !Number.isFinite(Number(report.location.lat)) || !Number.isFinite(Number(report.location.lng))) {
    errors.push('location_required');
  }
  return { valid: errors.length === 0, errors };
}

export function buildReplacementRequest({
  bookingId,
  incidentType = INCIDENT_TYPE.BREAKDOWN,
  originalPartnerId,
  originalVehicleId,
  progressPct = 0,
  originalFare,
  pickup,
  drop,
  currentLocation,
  service,
  vehicleClass,
  requiresCargoHandover = true,
}) {
  const remainingPct = Math.max(0, Math.min(100, 100 - Number(progressPct || 0)));
  return {
    bookingId,
    incidentType,
    originalPartnerId,
    originalVehicleId,
    originalFare: roundMoney(originalFare),
    progressPct: Number(progressPct || 0),
    remainingPct,
    pickup: currentLocation || pickup,
    originalPickup: pickup,
    drop,
    service,
    vehicleClass,
    requiresCargoHandover,
    customerMustRebook: false,
    status: REPLACEMENT_STATUS.REQUESTED,
  };
}

export function replacementFare({ originalFare, progressPct }) {
  const fare = Number(originalFare || 0);
  const progress = Math.max(0, Math.min(100, Number(progressPct || 0)));
  return roundMoney(fare * ((100 - progress) / 100));
}

export function replacementSettlement({
  originalFare,
  progressPct,
  commissionRatePct = 15,
  replacementPlan = 'COMMISSION',
}) {
  const fullFare = roundMoney(originalFare);
  const remainingFare = replacementFare({ originalFare: fullFare, progressPct });
  const platformCommissionOnOriginalBooking = roundMoney(fullFare * Number(commissionRatePct || 0) / 100);
  const replacementCommission = replacementPlan === 'SUBSCRIPTION'
    ? 0
    : roundMoney(remainingFare * Number(commissionRatePct || 0) / 100);
  const replacementPartnerEntitlement = replacementPlan === 'SUBSCRIPTION'
    ? remainingFare
    : roundMoney(remainingFare - replacementCommission);

  return {
    originalPartnerPayout: 0,
    fullOriginalFare: fullFare,
    remainingFare,
    platformCommissionOnOriginalBooking,
    replacementCommission,
    replacementPartnerEntitlement,
    customerAdditionalCharge: 0,
    customerMustRebook: false,
    originalPartnerFareForfeited: true,
  };
}

export function handoverChecklist({
  pickupProofPresent,
  handoverPhotoPresent,
  handoverOtpVerified,
  gpsCaptured,
  goodsConditionRecorded,
}) {
  const checks = {
    pickupProofPresent: Boolean(pickupProofPresent),
    handoverPhotoPresent: Boolean(handoverPhotoPresent),
    handoverOtpVerified: Boolean(handoverOtpVerified),
    gpsCaptured: Boolean(gpsCaptured),
    goodsConditionRecorded: Boolean(goodsConditionRecorded),
  };
  const complete = Object.values(checks).every(Boolean);
  return { complete, checks, missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key) };
}

export function replacementPriority({ activeTrip = true, perishableGoods = false, medicalOrCritical = false, strandedMinutes = 0 }) {
  let score = activeTrip ? 60 : 20;
  if (perishableGoods) score += 15;
  if (medicalOrCritical) score += 20;
  score += Math.min(15, Math.floor(Number(strandedMinutes || 0) / 10) * 3);
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 45) return 'NORMAL';
  return 'LOW';
}
