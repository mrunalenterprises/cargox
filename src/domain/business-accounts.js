export const BUSINESS_MEMBER_ROLE = Object.freeze({ OWNER: 'OWNER', ADMIN: 'ADMIN', BOOKER: 'BOOKER', VIEWER: 'VIEWER' });

export function normalizeGstin(value = '') {
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidGstin(value = '') {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGstin(value));
}

export function canBusinessMember(role, action) {
  const matrix = {
    OWNER: new Set(['manage_company','manage_staff','book','view_bookings','view_billing','export_statements']),
    ADMIN: new Set(['manage_staff','book','view_bookings','view_billing','export_statements']),
    BOOKER: new Set(['book','view_bookings']),
    VIEWER: new Set(['view_bookings','view_billing']),
  };
  return Boolean(matrix[role]?.has(action));
}

export function buildBusinessStatement({ month, bookings = [], adjustments = [] }) {
  const completed = bookings.filter(b => b.status === 'completed');
  const grossFare = completed.reduce((sum, b) => sum + Number(b.grossFare || 0), 0);
  const taxes = completed.reduce((sum, b) => sum + Number(b.taxAmount || 0), 0);
  const credits = adjustments.filter(a => a.type === 'credit').reduce((s,a)=>s + Number(a.amount || 0), 0);
  const debits = adjustments.filter(a => a.type === 'debit').reduce((s,a)=>s + Number(a.amount || 0), 0);
  return {
    month,
    bookingCount: completed.length,
    grossFare,
    taxes,
    credits,
    debits,
    amountDue: Math.max(0, grossFare + taxes + debits - credits),
  };
}

export function billingName({ legalName, tradeName }) {
  return String(legalName || tradeName || '').trim();
}
