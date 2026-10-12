export const REVENUE_TYPE = Object.freeze({
  COMMISSION: 'COMMISSION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  OTHER: 'OTHER',
});

export const RECON_STATUS = Object.freeze({
  MATCHED: 'MATCHED',
  PARTIAL: 'PARTIAL',
  MISMATCH: 'MISMATCH',
  PENDING: 'PENDING',
});

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function calculateCommissionRevenue({
  commissionableFare = 0,
  commissionRatePct = 15,
  gatewayFee = 0,
  refundsFromPlatformCommission = 0,
} = {}) {
  if (commissionableFare < 0 || commissionRatePct < 0) throw new Error('Invalid commission input');
  const grossCommission = money(commissionableFare * (commissionRatePct / 100));
  const netCommissionRevenue = money(Math.max(0, grossCommission - gatewayFee - refundsFromPlatformCommission));
  return { grossCommission, gatewayFee: money(gatewayFee), refundsFromPlatformCommission: money(refundsFromPlatformCommission), netCommissionRevenue };
}

export function calculateSubscriptionRevenue({ subscriptions = [] } = {}) {
  const paid = subscriptions.filter((s) => s?.status === 'PAID');
  const gross = money(paid.reduce((sum, s) => sum + Number(s.amount || 0), 0));
  const tax = money(paid.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0));
  return { paidCount: paid.length, grossSubscriptionCollection: gross, taxCollected: tax, subscriptionRevenueBeforeTax: money(gross - tax) };
}

export function reconcilePayout({ expectedAmount = 0, settledAmount = 0, tolerance = 1 } = {}) {
  const expected = money(expectedAmount);
  const settled = money(settledAmount);
  const difference = money(settled - expected);
  const abs = Math.abs(difference);
  let status = RECON_STATUS.MATCHED;
  if (abs > tolerance && settled === 0) status = RECON_STATUS.PENDING;
  else if (abs > tolerance && settled > 0 && settled < expected) status = RECON_STATUS.PARTIAL;
  else if (abs > tolerance) status = RECON_STATUS.MISMATCH;
  return { expectedAmount: expected, settledAmount: settled, difference, status };
}

export function buildFinanceDashboard({
  completedTrips = 0,
  grossBookingValue = 0,
  commissionGross = 0,
  subscriptionRevenue = 0,
  gatewayFees = 0,
  refunds = 0,
  goodwillCredits = 0,
  partnerPayouts = 0,
  operatingAdjustments = 0,
  pendingPayouts = 0,
} = {}) {
  const platformGrossRevenue = money(commissionGross + subscriptionRevenue);
  const directRevenueCosts = money(gatewayFees + refunds + goodwillCredits + operatingAdjustments);
  const platformNetRevenue = money(platformGrossRevenue - directRevenueCosts);
  const payoutCoveragePct = partnerPayouts > 0 ? money(((partnerPayouts - pendingPayouts) / partnerPayouts) * 100) : 100;
  return {
    completedTrips,
    grossBookingValue: money(grossBookingValue),
    platformGrossRevenue,
    gatewayFees: money(gatewayFees),
    refunds: money(refunds),
    goodwillCredits: money(goodwillCredits),
    operatingAdjustments: money(operatingAdjustments),
    platformNetRevenue,
    partnerPayouts: money(partnerPayouts),
    pendingPayouts: money(pendingPayouts),
    payoutCoveragePct: Math.max(0, Math.min(100, payoutCoveragePct)),
  };
}

export function financeAlertFlags({ dashboard, unreconciledCount = 0, negativeWalletPartners = 0 } = {}) {
  const flags = [];
  if (!dashboard) return flags;
  if (dashboard.pendingPayouts > 0) flags.push('PAYOUTS_PENDING');
  if (unreconciledCount > 0) flags.push('RECONCILIATION_PENDING');
  if (negativeWalletPartners > 0) flags.push('NEGATIVE_COMMISSION_BALANCE');
  if (dashboard.platformNetRevenue < 0) flags.push('NEGATIVE_NET_REVENUE');
  return flags;
}
