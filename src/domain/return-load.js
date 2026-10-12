export function toRad(deg) { return (deg * Math.PI) / 180; }

export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(from, to) {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lng - from.lng);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function bearingDifference(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function routeDirectionScore({ partnerDestination, partnerHomeOrReturnTarget, bookingPickup, bookingDrop }) {
  const returnBearing = bearingDeg(partnerDestination, partnerHomeOrReturnTarget);
  const jobBearing = bearingDeg(bookingPickup, bookingDrop);
  const diff = bearingDifference(returnBearing, jobBearing);
  if (diff <= 20) return 100;
  if (diff <= 40) return 80;
  if (diff <= 65) return 55;
  if (diff <= 90) return 30;
  return 0;
}

export function returnLoadMatchScore(input) {
  const {
    partnerDestination,
    partnerReturnTarget,
    bookingPickup,
    bookingDrop,
    maxPickupDetourKm = 6,
    maxDropDetourKm = 12,
    vehicleCompatible = true,
    serviceCompatible = true,
    partnerQualityScore = 75,
  } = input;

  if (!vehicleCompatible || !serviceCompatible) return { eligible: false, score: 0, reason: 'INCOMPATIBLE_SERVICE_OR_VEHICLE' };

  const pickupDetourKm = haversineKm(partnerDestination, bookingPickup);
  const dropDetourKm = haversineKm(bookingDrop, partnerReturnTarget);
  if (pickupDetourKm > maxPickupDetourKm || dropDetourKm > maxDropDetourKm) {
    return { eligible: false, score: 0, reason: 'EXCESSIVE_DETOUR', pickupDetourKm, dropDetourKm };
  }

  const direction = routeDirectionScore({
    partnerDestination,
    partnerHomeOrReturnTarget: partnerReturnTarget,
    bookingPickup,
    bookingDrop,
  });

  if (direction < 30) return { eligible: false, score: 0, reason: 'WRONG_DIRECTION', pickupDetourKm, dropDetourKm, directionScore: direction };

  const pickupScore = Math.max(0, 100 - (pickupDetourKm / maxPickupDetourKm) * 100);
  const dropScore = Math.max(0, 100 - (dropDetourKm / maxDropDetourKm) * 100);
  const quality = Math.max(0, Math.min(100, partnerQualityScore));
  const score = Math.round(direction * 0.45 + pickupScore * 0.25 + dropScore * 0.15 + quality * 0.15);

  return {
    eligible: score >= 55,
    score,
    reason: score >= 55 ? 'MATCHED' : 'LOW_MATCH_SCORE',
    pickupDetourKm: Number(pickupDetourKm.toFixed(2)),
    dropDetourKm: Number(dropDetourKm.toFixed(2)),
    directionScore: direction,
  };
}

export function calculateReturnLoadDiscount({ baseFare, matchScore, minDiscountPct = 0.10, maxDiscountPct = 0.15 }) {
  const fare = Math.max(0, Number(baseFare || 0));
  const normalized = Math.max(0, Math.min(100, Number(matchScore || 0)));
  const ratio = Math.max(0, (normalized - 55) / 45);
  const pct = minDiscountPct + (maxDiscountPct - minDiscountPct) * ratio;
  const discountPct = normalized < 55 ? 0 : Math.min(maxDiscountPct, Math.max(minDiscountPct, pct));
  const discountAmount = fare * discountPct;
  return {
    discountPct: Number((discountPct * 100).toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    customerFare: Number((fare - discountAmount).toFixed(2)),
  };
}

export function returnLoadPartnerEconomics({ customerFare, commissionRate = 0.15, partnerPlan = 'commission' }) {
  const fare = Math.max(0, Number(customerFare || 0));
  if (partnerPlan === 'subscription') {
    return { platformCommission: 0, partnerEarning: Number(fare.toFixed(2)), settlementMode: 'DIRECT_TO_PARTNER' };
  }
  const platformCommission = fare * commissionRate;
  return {
    platformCommission: Number(platformCommission.toFixed(2)),
    partnerEarning: Number((fare - platformCommission).toFixed(2)),
    settlementMode: 'PLATFORM_SETTLEMENT',
  };
}
