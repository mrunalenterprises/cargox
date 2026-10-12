export const HEALTH_LEVEL = Object.freeze({
  HEALTHY: 'HEALTHY',
  WATCH: 'WATCH',
  AT_RISK: 'AT_RISK',
  CRITICAL: 'CRITICAL',
});

export function safePercent(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

export function buildPlatformKpis({
  bookings = [],
  partners = [],
  customers = [],
  finance = {},
  incidents = [],
} = {}) {
  const completed = bookings.filter((b) => b.status === 'COMPLETED').length;
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
  const active = bookings.filter((b) => ['ASSIGNED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_TRANSIT'].includes(b.status)).length;
  const scheduled = bookings.filter((b) => b.status === 'SCHEDULED').length;
  const grossBookingValue = bookings.reduce((sum, b) => sum + Number(b.fareAmount || 0), 0);
  const onlinePartners = partners.filter((p) => p.isOnline === true).length;
  const restrictedPartners = partners.filter((p) => ['LOW', 'RESTRICTED'].includes(p.bookingPriority)).length;
  const restrictedCustomers = customers.filter((c) => ['PREPAID_ONLY', 'MANUAL_REVIEW', 'BLOCKED'].includes(c.restriction)).length;
  const openCriticalIncidents = incidents.filter((i) => i.status !== 'RESOLVED' && i.severity === 'CRITICAL').length;

  return {
    totalBookings: bookings.length,
    completedBookings: completed,
    cancelledBookings: cancelled,
    activeBookings: active,
    scheduledBookings: scheduled,
    completionRatePct: safePercent(completed, bookings.length),
    cancellationRatePct: safePercent(cancelled, bookings.length),
    grossBookingValue: Math.round(grossBookingValue * 100) / 100,
    activePartners: partners.filter((p) => p.status === 'ACTIVE').length,
    onlinePartners,
    restrictedPartners,
    totalCustomers: customers.length,
    restrictedCustomers,
    openCriticalIncidents,
    platformGrossRevenue: Number(finance.platformGrossRevenue || 0),
    platformNetRevenue: Number(finance.platformNetRevenue || 0),
    pendingPartnerPayout: Number(finance.pendingPartnerPayout || 0),
  };
}

export function summarizeCityPerformance(records = []) {
  const grouped = new Map();

  for (const row of records) {
    const cityId = row.cityId || 'UNKNOWN';
    const current = grouped.get(cityId) || {
      cityId,
      bookings: 0,
      completed: 0,
      cancelled: 0,
      grossFare: 0,
      activePartners: 0,
      onlinePartners: 0,
      avgEtaMinutesTotal: 0,
      avgEtaSamples: 0,
    };

    current.bookings += Number(row.bookings || 0);
    current.completed += Number(row.completed || 0);
    current.cancelled += Number(row.cancelled || 0);
    current.grossFare += Number(row.grossFare || 0);
    current.activePartners += Number(row.activePartners || 0);
    current.onlinePartners += Number(row.onlinePartners || 0);
    if (Number.isFinite(Number(row.avgEtaMinutes))) {
      current.avgEtaMinutesTotal += Number(row.avgEtaMinutes);
      current.avgEtaSamples += 1;
    }
    grouped.set(cityId, current);
  }

  return [...grouped.values()].map((city) => ({
    cityId: city.cityId,
    bookings: city.bookings,
    completed: city.completed,
    cancelled: city.cancelled,
    completionRatePct: safePercent(city.completed, city.bookings),
    cancellationRatePct: safePercent(city.cancelled, city.bookings),
    grossFare: Math.round(city.grossFare * 100) / 100,
    activePartners: city.activePartners,
    onlinePartners: city.onlinePartners,
    avgEtaMinutes: city.avgEtaSamples ? Math.round((city.avgEtaMinutesTotal / city.avgEtaSamples) * 10) / 10 : 0,
  }));
}

export function summarizeServicePerformance(bookings = []) {
  const grouped = new Map();
  for (const booking of bookings) {
    const service = booking.serviceCode || 'UNKNOWN';
    const current = grouped.get(service) || { serviceCode: service, bookings: 0, completed: 0, cancelled: 0, grossFare: 0 };
    current.bookings += 1;
    if (booking.status === 'COMPLETED') current.completed += 1;
    if (booking.status === 'CANCELLED') current.cancelled += 1;
    current.grossFare += Number(booking.fareAmount || 0);
    grouped.set(service, current);
  }

  return [...grouped.values()]
    .map((service) => ({
      ...service,
      completionRatePct: safePercent(service.completed, service.bookings),
      cancellationRatePct: safePercent(service.cancelled, service.bookings),
      grossFare: Math.round(service.grossFare * 100) / 100,
    }))
    .sort((a, b) => b.bookings - a.bookings);
}

export function evaluateOperationsHealth({
  completionRatePct = 100,
  cancellationRatePct = 0,
  openCriticalIncidents = 0,
  partnerSupplyRatioPct = 100,
  payoutMismatchCount = 0,
} = {}) {
  let score = 100;
  if (completionRatePct < 95) score -= Math.min(25, (95 - completionRatePct) * 2);
  if (cancellationRatePct > 5) score -= Math.min(20, (cancellationRatePct - 5) * 2);
  score -= Math.min(25, openCriticalIncidents * 8);
  if (partnerSupplyRatioPct < 70) score -= Math.min(20, (70 - partnerSupplyRatioPct) * 0.75);
  score -= Math.min(15, payoutMismatchCount * 3);
  score = Math.max(0, Math.round(score));

  let level = HEALTH_LEVEL.HEALTHY;
  if (score < 85) level = HEALTH_LEVEL.WATCH;
  if (score < 65) level = HEALTH_LEVEL.AT_RISK;
  if (score < 40) level = HEALTH_LEVEL.CRITICAL;

  return { score, level };
}

export function buildLiveOperationsSummary({
  activeTrips = [],
  unassignedBookings = [],
  incidents = [],
  supportCases = [],
} = {}) {
  const latePickups = activeTrips.filter((t) => Number(t.pickupDelayMinutes || 0) >= 15).length;
  const routeDeviations = activeTrips.filter((t) => t.routeDeviation === true).length;
  const breakdowns = incidents.filter((i) => i.status !== 'RESOLVED' && i.type === 'BREAKDOWN').length;
  const safety = incidents.filter((i) => i.status !== 'RESOLVED' && ['SAFETY', 'SOS'].includes(i.type)).length;
  const urgentSupport = supportCases.filter((c) => !['RESOLVED', 'CLOSED'].includes(c.status) && ['HIGH', 'URGENT'].includes(c.priority)).length;

  return {
    activeTrips: activeTrips.length,
    unassignedBookings: unassignedBookings.length,
    latePickups,
    routeDeviations,
    openBreakdowns: breakdowns,
    openSafetyIncidents: safety,
    urgentSupportCases: urgentSupport,
    requiresImmediateAttention: safety > 0 || breakdowns > 0 || urgentSupport > 0 || unassignedBookings.length >= 5,
  };
}
