export const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  GM: 'GM',
  ACCOUNTS: 'ACCOUNTS',
  FIELD_OFFICER: 'FIELD_OFFICER',
});

export const PARTNER_REVIEW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

export function canReviewPartner(role) {
  return [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.GM, ADMIN_ROLES.FIELD_OFFICER].includes(role);
}

export function canApprovePricing(role) {
  return [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.GM].includes(role);
}

export function canManagePayouts(role) {
  return [ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ACCOUNTS].includes(role);
}

export function validatePricingRule(rule) {
  const required = ['cityCode', 'serviceType', 'vehicleClass', 'baseFare', 'includedKm', 'includedMinutes', 'extraKmRate', 'extraMinuteRate'];
  const missing = required.filter((k) => rule[k] === undefined || rule[k] === null || rule[k] === '');
  if (missing.length) return { ok: false, errors: missing.map((k) => `${k} is required`) };
  if (Number(rule.baseFare) < 0 || Number(rule.extraKmRate) < 0 || Number(rule.extraMinuteRate) < 0) {
    return { ok: false, errors: ['pricing values cannot be negative'] };
  }
  return { ok: true, errors: [] };
}

export function createAuditEvent({ actorUserId, actorRole, action, entityType, entityId, before = null, after = null, reason = null }) {
  if (!actorUserId || !actorRole || !action || !entityType || !entityId) {
    throw new Error('audit event missing required fields');
  }
  return {
    actorUserId,
    actorRole,
    action,
    entityType,
    entityId,
    before,
    after,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function liveOpsRiskFlags(booking) {
  const flags = [];
  if (booking.status === 'SEARCHING_PARTNER' && Number(booking.searchSeconds || 0) >= 60) flags.push('LONG_SEARCH');
  if (booking.status === 'PARTNER_ASSIGNED' && Number(booking.pickupEtaMinutes || 0) >= 25) flags.push('LATE_PICKUP_RISK');
  if (booking.status === 'REPLACEMENT_REQUIRED') flags.push('BREAKDOWN_REPLACEMENT');
  if (booking.supportCaseOpen) flags.push('ACTIVE_SUPPORT_CASE');
  if (Number(booking.partnerQualityScore || 100) < 60) flags.push('LOW_PARTNER_QUALITY');
  return flags;
}

export function adminDashboardCounters(bookings = []) {
  const counters = {
    active: 0,
    searching: 0,
    replacementRequired: 0,
    supportCases: 0,
    completedToday: 0,
  };
  for (const booking of bookings) {
    if (['PARTNER_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_TRANSIT', 'SEARCHING_PARTNER', 'REPLACEMENT_REQUIRED'].includes(booking.status)) counters.active += 1;
    if (booking.status === 'SEARCHING_PARTNER') counters.searching += 1;
    if (booking.status === 'REPLACEMENT_REQUIRED') counters.replacementRequired += 1;
    if (booking.supportCaseOpen) counters.supportCases += 1;
    if (booking.status === 'COMPLETED' && booking.completedToday) counters.completedToday += 1;
  }
  return counters;
}
