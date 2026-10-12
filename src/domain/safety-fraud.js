export const SOS_SEVERITY = Object.freeze({ INFO: 'INFO', HIGH: 'HIGH', CRITICAL: 'CRITICAL' });

export function createShareToken({ bookingId, expiresAt, nonce }) {
  if (!bookingId || !expiresAt || !nonce) throw new Error('bookingId, expiresAt and nonce are required');
  return Buffer.from(`${bookingId}|${expiresAt}|${nonce}`).toString('base64url');
}

export function shareLinkStatus({ expiresAt, now = new Date(), revokedAt = null }) {
  if (revokedAt) return 'REVOKED';
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'INVALID';
  return expiry.getTime() > new Date(now).getTime() ? 'ACTIVE' : 'EXPIRED';
}

export function classifySOS({ source = 'customer', reason = 'other', tripActive = false }) {
  const criticalReasons = new Set(['accident', 'threat', 'violence', 'medical_emergency']);
  const highReasons = new Set(['vehicle_breakdown_unsafe_location', 'route_deviation', 'unresponsive_party']);
  const severity = criticalReasons.has(reason)
    ? SOS_SEVERITY.CRITICAL
    : highReasons.has(reason) || tripActive
      ? SOS_SEVERITY.HIGH
      : SOS_SEVERITY.INFO;
  return { source, reason, severity, requiresHumanEscalation: severity !== SOS_SEVERITY.INFO };
}

export function fraudRiskScore(signals = {}) {
  const {
    gpsJumpKm = 0,
    gpsJumpSeconds = 999,
    repeatedDeviceAccounts = 1,
    customerCancellationRate = 0,
    partnerPostAcceptCancellationRate = 0,
    paymentChargebackCount90d = 0,
    duplicateProofHash = false,
    impossibleTripSpeedKph = 0,
    repeatedReferralFingerprint = false,
  } = signals;

  let score = 0;
  if (gpsJumpKm >= 3 && gpsJumpSeconds <= 60) score += 22;
  if (impossibleTripSpeedKph > 140) score += 18;
  if (repeatedDeviceAccounts >= 3) score += 16;
  if (customerCancellationRate >= 60) score += 10;
  if (partnerPostAcceptCancellationRate >= 15) score += 12;
  if (paymentChargebackCount90d >= 2) score += 18;
  if (duplicateProofHash) score += 20;
  if (repeatedReferralFingerprint) score += 14;
  return Math.min(100, score);
}

export function fraudDecision(score) {
  if (score >= 70) return { level: 'CRITICAL', action: 'BLOCK_AND_REVIEW' };
  if (score >= 45) return { level: 'HIGH', action: 'MANUAL_REVIEW' };
  if (score >= 20) return { level: 'MEDIUM', action: 'LIMIT_AND_MONITOR' };
  return { level: 'LOW', action: 'ALLOW' };
}

export function routeDeviationAlert({ plannedDistanceFromRouteM, graceMeters = 500, sustainedSeconds = 0 }) {
  const deviated = plannedDistanceFromRouteM > graceMeters && sustainedSeconds >= 120;
  return {
    deviated,
    severity: deviated && plannedDistanceFromRouteM > 2000 ? 'HIGH' : deviated ? 'MEDIUM' : 'LOW',
  };
}

export function shouldAutoSuspend({ fraudScore = 0, unresolvedCriticalIncidents = 0, documentFraudConfirmed = false }) {
  return documentFraudConfirmed || fraudScore >= 85 || unresolvedCriticalIncidents >= 2;
}
