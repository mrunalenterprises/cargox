export const REQUIRED_PARTNER_DOCS = ['aadhaar','pan','driving_licence','bank_proof'];
export const REQUIRED_VEHICLE_DOCS = ['rc','insurance','puc','fitness','permit'];

export function onboardingCompletion({ personalDocs = {}, vehicleDocs = {}, selfieVerified = false, bankVerified = false }) {
  const personalDone = REQUIRED_PARTNER_DOCS.filter(k => personalDocs[k]?.status === 'APPROVED').length;
  const vehicleDone = REQUIRED_VEHICLE_DOCS.filter(k => vehicleDocs[k]?.status === 'APPROVED').length;
  const total = REQUIRED_PARTNER_DOCS.length + REQUIRED_VEHICLE_DOCS.length + 2;
  const done = personalDone + vehicleDone + Number(selfieVerified) + Number(bankVerified);
  return Math.round((done / total) * 100);
}

export function reviewStage(state) {
  if (state.adminDecision === 'REJECTED') return 'REJECTED';
  if (state.adminDecision === 'APPROVED') return 'ACTIVE_OFFLINE';
  if (!state.staffApproved) return 'STAFF_REVIEW';
  return 'ADMIN_REVIEW';
}

export function canGoOnline({ onboardingStatus, identitySelfieMatched, vehicleEligible, docsExpired = false }) {
  return onboardingStatus === 'ACTIVE_OFFLINE' && identitySelfieMatched === true && vehicleEligible === true && docsExpired === false;
}

export function documentExpiryState(expiryDate, now = new Date()) {
  if (!expiryDate) return 'MISSING';
  const expiry = new Date(expiryDate);
  const ms = expiry.getTime() - now.getTime();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return 'EXPIRED';
  if (days <= 7) return 'CRITICAL';
  if (days <= 30) return 'EXPIRING_SOON';
  return 'VALID';
}

export function eligibilityFromDocs(docs, now = new Date()) {
  const states = Object.values(docs).map(d => documentExpiryState(d?.expiryDate, now));
  return {
    eligible: states.every(s => s === 'VALID' || s === 'EXPIRING_SOON' || s === 'CRITICAL'),
    hasExpired: states.includes('EXPIRED') || states.includes('MISSING'),
    needsAlert: states.some(s => s === 'EXPIRING_SOON' || s === 'CRITICAL' || s === 'EXPIRED'),
  };
}
