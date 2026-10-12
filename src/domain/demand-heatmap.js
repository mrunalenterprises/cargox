const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const round = (n, d = 2) => Number(Number(n || 0).toFixed(d));

export const DEMAND_LEVEL = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH',
  SURGE_RISK: 'SURGE_RISK',
});

export const HOTSPOT_ACTION = Object.freeze({
  NONE: 'NONE',
  WATCH: 'WATCH',
  POSITION_PARTNERS: 'POSITION_PARTNERS',
  URGENT_POSITIONING: 'URGENT_POSITIONING',
});

export function calculateSupplyDemandScore({
  openBookings = 0,
  scheduledNext60Min = 0,
  recentSearches = 0,
  onlinePartners = 0,
  availablePartners = 0,
  avgPickupEtaMin = 0,
  cancellationRatePct = 0,
}) {
  const demand =
    Number(openBookings) * 4 +
    Number(scheduledNext60Min) * 2.5 +
    Number(recentSearches) * 0.6;

  const supply =
    Number(availablePartners) * 4 +
    Math.max(0, Number(onlinePartners) - Number(availablePartners)) * 1.5;

  const etaPenalty = Math.max(0, Number(avgPickupEtaMin) - 8) * 1.7;
  const cancellationPenalty = Number(cancellationRatePct) * 0.8;

  const raw = 50 + demand - supply + etaPenalty + cancellationPenalty;
  return round(clamp(raw, 0, 100));
}

export function demandLevelFromScore(score) {
  const s = Number(score || 0);
  if (s >= 90) return DEMAND_LEVEL.SURGE_RISK;
  if (s >= 75) return DEMAND_LEVEL.VERY_HIGH;
  if (s >= 60) return DEMAND_LEVEL.HIGH;
  if (s >= 35) return DEMAND_LEVEL.NORMAL;
  return DEMAND_LEVEL.LOW;
}

export function estimatePartnerShortage({
  openBookings = 0,
  scheduledNext60Min = 0,
  availablePartners = 0,
  targetBookingsPerPartner = 1.2,
}) {
  const weightedDemand = Number(openBookings) + Number(scheduledNext60Min) * 0.65;
  const required = Math.ceil(weightedDemand / Math.max(0.5, Number(targetBookingsPerPartner)));
  return Math.max(0, required - Number(availablePartners));
}

export function predictHotspot({
  currentScore,
  previousScore = 0,
  openBookings = 0,
  availablePartners = 0,
  scheduledNext60Min = 0,
}) {
  const score = Number(currentScore || 0);
  const trend = score - Number(previousScore || 0);
  const shortage = estimatePartnerShortage({ openBookings, availablePartners, scheduledNext60Min });
  const level = demandLevelFromScore(score);

  let action = HOTSPOT_ACTION.NONE;
  if (score >= 85 || shortage >= 5) action = HOTSPOT_ACTION.URGENT_POSITIONING;
  else if (score >= 70 || shortage >= 3) action = HOTSPOT_ACTION.POSITION_PARTNERS;
  else if (score >= 55 || trend >= 12) action = HOTSPOT_ACTION.WATCH;

  return {
    score: round(score),
    level,
    trend: round(trend),
    partnerShortage: shortage,
    action,
    isHotspot: score >= 60 || shortage >= 3,
  };
}

export function buildPartnerPositioningAlert({
  zoneName,
  serviceName,
  score,
  estimatedExtraTrips = 0,
  distanceToZoneKm = 0,
  expiresInMin = 30,
}) {
  const level = demandLevelFromScore(score);
  if (![DEMAND_LEVEL.HIGH, DEMAND_LEVEL.VERY_HIGH, DEMAND_LEVEL.SURGE_RISK].includes(level)) {
    return null;
  }

  return {
    type: 'HIGH_DEMAND_POSITIONING',
    title: 'High demand near you',
    zoneName,
    serviceName,
    demandLevel: level,
    demandScore: round(score),
    distanceToZoneKm: round(distanceToZoneKm),
    estimatedExtraTrips: Math.max(0, Math.floor(Number(estimatedExtraTrips || 0))),
    expiresInMin: Math.max(5, Math.floor(Number(expiresInMin || 30))),
  };
}

export function rankDemandZones(zones = []) {
  return [...zones]
    .map((zone) => ({
      ...zone,
      demandScore: calculateSupplyDemandScore(zone),
    }))
    .map((zone) => ({
      ...zone,
      demandLevel: demandLevelFromScore(zone.demandScore),
      partnerShortage: estimatePartnerShortage(zone),
    }))
    .sort((a, b) => {
      if (b.demandScore !== a.demandScore) return b.demandScore - a.demandScore;
      return b.partnerShortage - a.partnerShortage;
    });
}

export function heatmapCell({
  cityId,
  zoneId,
  serviceCode,
  lat,
  lng,
  metrics,
  previousScore = 0,
  capturedAt = new Date().toISOString(),
}) {
  const score = calculateSupplyDemandScore(metrics);
  const prediction = predictHotspot({ currentScore: score, previousScore, ...metrics });
  return {
    cityId,
    zoneId,
    serviceCode,
    lat: Number(lat),
    lng: Number(lng),
    demandScore: score,
    demandLevel: prediction.level,
    partnerShortage: prediction.partnerShortage,
    hotspotAction: prediction.action,
    capturedAt,
  };
}
