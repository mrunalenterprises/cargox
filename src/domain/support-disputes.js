export const SUPPORT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  WAITING_PARTNER: 'WAITING_PARTNER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

export const SUPPORT_PRIORITY = Object.freeze({
  LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT',
});

export function buildSupportCase({
  bookingId,
  customerId = null,
  partnerId = null,
  category,
  isActiveTrip = false,
  safetyRisk = false,
  paymentBlocked = false,
}) {
  if (!bookingId) throw new Error('bookingId is required');
  if (!category) throw new Error('category is required');

  const priority = safetyRisk || isActiveTrip
    ? SUPPORT_PRIORITY.URGENT
    : paymentBlocked
      ? SUPPORT_PRIORITY.HIGH
      : SUPPORT_PRIORITY.NORMAL;

  return {
    bookingId,
    customerId,
    partnerId,
    category,
    status: SUPPORT_STATUS.OPEN,
    priority,
    caseOwnerId: null,
    activeTripEscalation: Boolean(isActiveTrip),
    safetyRisk: Boolean(safetyRisk),
  };
}

export function canCreateAnotherCaseForBooking(existingCases = []) {
  return !existingCases.some(c => ![SUPPORT_STATUS.RESOLVED, SUPPORT_STATUS.CLOSED].includes(c.status));
}

export function assignCaseOwner(supportCase, staffUserId) {
  if (!supportCase || !staffUserId) throw new Error('case and staffUserId are required');
  if ([SUPPORT_STATUS.RESOLVED, SUPPORT_STATUS.CLOSED].includes(supportCase.status)) {
    throw new Error('cannot assign a closed case');
  }
  return {
    ...supportCase,
    caseOwnerId: staffUserId,
    status: supportCase.status === SUPPORT_STATUS.OPEN ? SUPPORT_STATUS.IN_REVIEW : supportCase.status,
  };
}

export function resolutionEligibility({ status, caseOwnerId, resolutionCode, notes }) {
  const errors = [];
  if (!caseOwnerId) errors.push('case_owner_required');
  if (!resolutionCode) errors.push('resolution_code_required');
  if (!String(notes || '').trim()) errors.push('resolution_notes_required');
  if ([SUPPORT_STATUS.RESOLVED, SUPPORT_STATUS.CLOSED].includes(status)) errors.push('case_already_final');
  return { ok: errors.length === 0, errors };
}

export function calculateCustomerRemedy({
  issueType,
  farePaid = 0,
  affectedFare = 0,
  customerAtFault = false,
  serviceDelivered = true,
  goodwillCredit = 0,
}) {
  if (customerAtFault) return { refundAmount: 0, creditAmount: 0, action: 'NO_REFUND' };

  const safeFare = Math.max(0, Number(farePaid) || 0);
  const affected = Math.max(0, Number(affectedFare) || 0);
  const credit = Math.max(0, Number(goodwillCredit) || 0);

  if (issueType === 'SERVICE_NOT_DELIVERED') {
    return { refundAmount: safeFare, creditAmount: credit, action: 'FULL_REFUND' };
  }
  if (issueType === 'BREAKDOWN_REPLACED' && serviceDelivered) {
    return { refundAmount: 0, creditAmount: credit, action: credit > 0 ? 'GOODWILL_CREDIT' : 'NO_REFUND' };
  }
  if (issueType === 'OVERCHARGE') {
    return { refundAmount: Math.min(safeFare, affected), creditAmount: credit, action: 'PARTIAL_REFUND' };
  }
  if (issueType === 'DAMAGE_CLAIM') {
    return { refundAmount: 0, creditAmount: credit, action: 'MANUAL_DAMAGE_REVIEW' };
  }
  return { refundAmount: 0, creditAmount: credit, action: credit > 0 ? 'GOODWILL_CREDIT' : 'MANUAL_REVIEW' };
}

export function refundApprovalLevel(amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (value <= 500) return 'SUPPORT';
  if (value <= 2500) return 'GM';
  return 'SUPER_ADMIN';
}
