export const SUPPORT_PRIORITY = Object.freeze({
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
});

export const ESCALATION_ROLE = Object.freeze({
  SUPPORT: 'SUPPORT',
  GM: 'GM',
  SUPER_ADMIN: 'SUPER_ADMIN',
  SAFETY: 'SAFETY',
});

export const SLA_STATUS = Object.freeze({
  ON_TRACK: 'ON_TRACK',
  RESPONSE_DUE: 'RESPONSE_DUE',
  RESPONSE_BREACHED: 'RESPONSE_BREACHED',
  RESOLUTION_DUE: 'RESOLUTION_DUE',
  RESOLUTION_BREACHED: 'RESOLUTION_BREACHED',
  RESOLVED: 'RESOLVED',
});

const DEFAULT_SLA = Object.freeze({
  P0: { firstResponseMinutes: 2, gmEscalationMinutes: 5, superAdminEscalationMinutes: 10, resolutionMinutes: 30 },
  P1: { firstResponseMinutes: 5, gmEscalationMinutes: 15, superAdminEscalationMinutes: 30, resolutionMinutes: 120 },
  P2: { firstResponseMinutes: 15, gmEscalationMinutes: 60, superAdminEscalationMinutes: 180, resolutionMinutes: 480 },
  P3: { firstResponseMinutes: 60, gmEscalationMinutes: 240, superAdminEscalationMinutes: 720, resolutionMinutes: 1440 },
});

const MINUTE = 60_000;

function asDate(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date`);
  return date;
}

export function deriveSupportPriority({ activeTrip = false, safetyRisk = false, sos = false, incidentType = '', stranded = false } = {}) {
  const type = String(incidentType).toUpperCase();
  if (sos || safetyRisk || ['ACCIDENT', 'THREAT', 'MEDICAL'].includes(type)) return SUPPORT_PRIORITY.P0;
  if (activeTrip || stranded || ['BREAKDOWN', 'VEHICLE_UNAVAILABLE', 'PARTNER_CANCELLED'].includes(type)) return SUPPORT_PRIORITY.P1;
  if (['PAYMENT', 'DAMAGE', 'DISPUTE', 'REFUND'].includes(type)) return SUPPORT_PRIORITY.P2;
  return SUPPORT_PRIORITY.P3;
}

export function getSlaTargets(priority, overrides = {}) {
  if (!DEFAULT_SLA[priority]) throw new Error('Unsupported support priority');
  const merged = { ...DEFAULT_SLA[priority], ...(overrides[priority] || overrides) };
  for (const key of ['firstResponseMinutes', 'gmEscalationMinutes', 'superAdminEscalationMinutes', 'resolutionMinutes']) {
    if (!Number.isFinite(Number(merged[key])) || Number(merged[key]) < 0) throw new Error(`Invalid SLA target: ${key}`);
    merged[key] = Number(merged[key]);
  }
  return merged;
}

export function evaluateSupportSla({ priority, openedAt, firstResponseAt = null, resolvedAt = null, now = new Date(), overrides = {} }) {
  const opened = asDate(openedAt, 'openedAt');
  const current = asDate(now, 'now');
  const targets = getSlaTargets(priority, overrides);
  const elapsedMinutes = Math.max(0, Math.floor((current - opened) / MINUTE));

  if (resolvedAt) {
    const resolved = asDate(resolvedAt, 'resolvedAt');
    const resolutionMinutes = Math.max(0, Math.floor((resolved - opened) / MINUTE));
    return {
      status: SLA_STATUS.RESOLVED,
      elapsedMinutes,
      resolutionMinutes,
      resolutionWithinSla: resolutionMinutes <= targets.resolutionMinutes,
      targets,
    };
  }

  if (!firstResponseAt) {
    if (elapsedMinutes > targets.firstResponseMinutes) {
      return { status: SLA_STATUS.RESPONSE_BREACHED, elapsedMinutes, minutesOver: elapsedMinutes - targets.firstResponseMinutes, targets };
    }
    if (elapsedMinutes >= Math.max(0, targets.firstResponseMinutes - 2)) {
      return { status: SLA_STATUS.RESPONSE_DUE, elapsedMinutes, minutesRemaining: targets.firstResponseMinutes - elapsedMinutes, targets };
    }
  }

  if (elapsedMinutes > targets.resolutionMinutes) {
    return { status: SLA_STATUS.RESOLUTION_BREACHED, elapsedMinutes, minutesOver: elapsedMinutes - targets.resolutionMinutes, targets };
  }
  if (elapsedMinutes >= Math.max(0, targets.resolutionMinutes - 15)) {
    return { status: SLA_STATUS.RESOLUTION_DUE, elapsedMinutes, minutesRemaining: targets.resolutionMinutes - elapsedMinutes, targets };
  }

  return { status: SLA_STATUS.ON_TRACK, elapsedMinutes, targets };
}

export function nextSupportEscalation({ priority, openedAt, now = new Date(), currentRole = ESCALATION_ROLE.SUPPORT, safetyRisk = false, overrides = {} }) {
  const opened = asDate(openedAt, 'openedAt');
  const current = asDate(now, 'now');
  const elapsedMinutes = Math.max(0, Math.floor((current - opened) / MINUTE));
  const targets = getSlaTargets(priority, overrides);

  if (safetyRisk && currentRole !== ESCALATION_ROLE.SAFETY && currentRole !== ESCALATION_ROLE.SUPER_ADMIN) {
    return { escalate: true, toRole: ESCALATION_ROLE.SAFETY, reason: 'SAFETY_PRIORITY', elapsedMinutes };
  }
  if (elapsedMinutes >= targets.superAdminEscalationMinutes && currentRole !== ESCALATION_ROLE.SUPER_ADMIN) {
    return { escalate: true, toRole: ESCALATION_ROLE.SUPER_ADMIN, reason: 'SUPER_ADMIN_TIMER', elapsedMinutes };
  }
  if (elapsedMinutes >= targets.gmEscalationMinutes && currentRole === ESCALATION_ROLE.SUPPORT) {
    return { escalate: true, toRole: ESCALATION_ROLE.GM, reason: 'GM_TIMER', elapsedMinutes };
  }
  return { escalate: false, toRole: currentRole, reason: 'NO_ESCALATION', elapsedMinutes };
}

export function buildEscalationPlan({ priority, openedAt, overrides = {} }) {
  const opened = asDate(openedAt, 'openedAt');
  const targets = getSlaTargets(priority, overrides);
  const at = (minutes) => new Date(opened.getTime() + minutes * MINUTE).toISOString();
  return {
    priority,
    firstResponseDueAt: at(targets.firstResponseMinutes),
    gmEscalateAt: at(targets.gmEscalationMinutes),
    superAdminEscalateAt: at(targets.superAdminEscalationMinutes),
    resolutionDueAt: at(targets.resolutionMinutes),
    activeTripHumanSupport: [SUPPORT_PRIORITY.P0, SUPPORT_PRIORITY.P1].includes(priority),
  };
}
