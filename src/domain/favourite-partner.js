export const PREFERRED_PARTNER_REASON = Object.freeze({
  FAVOURITE: 'FAVOURITE',
  BOOK_AGAIN: 'BOOK_AGAIN',
  REPEAT_CUSTOMER: 'REPEAT_CUSTOMER',
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function buildFavouritePartner({ customerId, partnerId, serviceType = null, vehicleId = null }) {
  if (!customerId) throw new Error('customerId is required');
  if (!partnerId) throw new Error('partnerId is required');

  return {
    customerId,
    partnerId,
    serviceType,
    vehicleId,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function canBookAgain({ previousBooking, customerId, partner }) {
  if (!previousBooking || !customerId || !partner) return { eligible: false, reason: 'MISSING_DATA' };
  if (previousBooking.customerId !== customerId) return { eligible: false, reason: 'CUSTOMER_MISMATCH' };
  if (previousBooking.status !== 'COMPLETED') return { eligible: false, reason: 'PREVIOUS_TRIP_NOT_COMPLETED' };
  if (!previousBooking.partnerId || previousBooking.partnerId !== partner.partnerId) {
    return { eligible: false, reason: 'PARTNER_MISMATCH' };
  }
  if (partner.accountStatus !== 'ACTIVE') return { eligible: false, reason: 'PARTNER_NOT_ACTIVE' };
  if (partner.documentEligible === false) return { eligible: false, reason: 'DOCUMENTS_NOT_ELIGIBLE' };
  if (partner.serviceCompatible === false) return { eligible: false, reason: 'SERVICE_NOT_COMPATIBLE' };

  return { eligible: true, reason: 'ELIGIBLE' };
}

export function buildBookAgainRequest({ previousBooking, customerId, scheduleAt = null }) {
  if (!previousBooking) throw new Error('previousBooking is required');
  if (previousBooking.customerId !== customerId) throw new Error('customer mismatch');
  if (previousBooking.status !== 'COMPLETED') throw new Error('only completed booking can be repeated');

  return {
    sourceBookingId: previousBooking.bookingId,
    customerId,
    preferredPartnerId: previousBooking.partnerId || null,
    preferredVehicleId: previousBooking.vehicleId || null,
    serviceType: previousBooking.serviceType,
    pickup: previousBooking.pickup,
    drop: previousBooking.drop,
    goodsSummary: previousBooking.goodsSummary || null,
    helperRequired: Boolean(previousBooking.helperRequired),
    scheduleAt,
    pricingMode: 'REPRICE_REQUIRED',
    copyOldFare: false,
  };
}

export function preferredPartnerMatchScore({
  isFavourite = false,
  isBookAgain = false,
  completedTripsTogether = 0,
  partnerQualityScore = 0,
  rating = 0,
  distanceKm = 0,
  available = true,
  serviceCompatible = true,
  documentEligible = true,
  suspended = false,
  activeSafetyBlock = false,
}) {
  if (!available) return { eligible: false, score: 0, reason: 'NOT_AVAILABLE' };
  if (!serviceCompatible) return { eligible: false, score: 0, reason: 'SERVICE_NOT_COMPATIBLE' };
  if (!documentEligible) return { eligible: false, score: 0, reason: 'DOCUMENTS_NOT_ELIGIBLE' };
  if (suspended || activeSafetyBlock) return { eligible: false, score: 0, reason: 'SAFETY_OR_ACCOUNT_BLOCK' };

  const quality = clamp(Number(partnerQualityScore) || 0, 0, 100);
  const normalizedRating = clamp((Number(rating) || 0) / 5 * 100, 0, 100);
  const proximity = clamp(100 - (Math.max(0, Number(distanceKm) || 0) * 8), 0, 100);
  const repeat = clamp((Number(completedTripsTogether) || 0) * 8, 0, 40);
  const preferenceBoost = (isFavourite ? 12 : 0) + (isBookAgain ? 8 : 0);

  // Preference can improve ranking but never bypass safety, documents, compatibility or availability.
  const raw = quality * 0.42 + normalizedRating * 0.18 + proximity * 0.22 + repeat * 0.18 + preferenceBoost;
  const score = round2(clamp(raw, 0, 100));

  const reasons = [];
  if (isFavourite) reasons.push(PREFERRED_PARTNER_REASON.FAVOURITE);
  if (isBookAgain) reasons.push(PREFERRED_PARTNER_REASON.BOOK_AGAIN);
  if (completedTripsTogether > 0) reasons.push(PREFERRED_PARTNER_REASON.REPEAT_CUSTOMER);

  return { eligible: true, score, reasons };
}

export function rankPreferredPartners(candidates = []) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      match: preferredPartnerMatchScore(candidate),
    }))
    .filter((candidate) => candidate.match.eligible)
    .sort((a, b) => b.match.score - a.match.score);
}

export function buildRepeatCustomerSummary({ completedTripsTogether = 0, lastCompletedAt = null }) {
  const trips = Math.max(0, Number(completedTripsTogether) || 0);
  return {
    isRepeatCustomer: trips > 0,
    completedTripsTogether: trips,
    label: trips === 0 ? 'New customer' : trips === 1 ? '1 completed trip together' : `${trips} completed trips together`,
    lastCompletedAt,
  };
}
