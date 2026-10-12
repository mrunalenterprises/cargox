export const PARTNER_PLAN = Object.freeze({
  SUBSCRIPTION: 'SUBSCRIPTION',
  COMMISSION: 'COMMISSION',
});

export const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  DIRECT_UPI: 'DIRECT_UPI',
  ONLINE: 'ONLINE',
});

export const PAYOUT_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
});

const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function commissionFor({ commissionableFare, commissionRate = 0.15 }) {
  if (commissionRate < 0 || commissionRate > 1) throw new Error('INVALID_COMMISSION_RATE');
  return money(Math.max(0, Number(commissionableFare || 0)) * commissionRate);
}

export function calculateTripSettlement({
  plan,
  paymentMethod,
  commissionableFare,
  passthroughAmount = 0,
  commissionRate = 0.15,
  gatewayCost = 0,
}) {
  const fare = money(commissionableFare);
  const passthrough = money(passthroughAmount);
  const totalCustomerAmount = money(fare + passthrough);

  if (plan === PARTNER_PLAN.SUBSCRIPTION) {
    if (paymentMethod === PAYMENT_METHOD.ONLINE) throw new Error('SUBSCRIPTION_ONLINE_COLLECTION_NOT_ALLOWED');
    return {
      plan,
      settlementMode: 'DIRECT_TO_PARTNER',
      totalCustomerAmount,
      platformCommission: 0,
      commissionBalanceDelta: 0,
      earningsBalanceDelta: 0,
      partnerDirectReceipt: totalCustomerAmount,
      gatewayCostToPlatform: 0,
    };
  }

  if (plan !== PARTNER_PLAN.COMMISSION) throw new Error('INVALID_PARTNER_PLAN');
  const platformCommission = commissionFor({ commissionableFare: fare, commissionRate });

  if (paymentMethod === PAYMENT_METHOD.ONLINE) {
    const partnerEntitlement = money(fare - platformCommission + passthrough);
    return {
      plan,
      settlementMode: 'PLATFORM_COLLECTION',
      totalCustomerAmount,
      platformCommission,
      commissionBalanceDelta: 0,
      earningsBalanceDelta: partnerEntitlement,
      partnerDirectReceipt: 0,
      gatewayCostToPlatform: money(gatewayCost),
      platformNetCommission: money(platformCommission - gatewayCost),
    };
  }

  if (![PAYMENT_METHOD.CASH, PAYMENT_METHOD.DIRECT_UPI].includes(paymentMethod)) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  return {
    plan,
    settlementMode: 'DIRECT_TO_PARTNER_WITH_COMMISSION_DEBIT',
    totalCustomerAmount,
    platformCommission,
    commissionBalanceDelta: -platformCommission,
    earningsBalanceDelta: 0,
    partnerDirectReceipt: totalCustomerAmount,
    gatewayCostToPlatform: 0,
  };
}

export function subscriptionStatus({ plan, validUntil, now = new Date() }) {
  if (plan !== PARTNER_PLAN.SUBSCRIPTION) return { active: false, label: 'Commission Partner', daysLeft: null };
  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return { active: false, label: 'Subscription Expired', daysLeft: 0 };
  const diffMs = expiry.getTime() - new Date(now).getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / 86400000));
  return { active: diffMs >= 0, label: diffMs >= 0 ? 'Subscription Active' : 'Subscription Expired', daysLeft };
}

export function cashBookingEligibility({ plan, commissionBalance, minimumRequired = 0 }) {
  if (plan === PARTNER_PLAN.SUBSCRIPTION) return { allowed: true, reason: 'SUBSCRIPTION_DIRECT_PAYMENT' };
  const balance = money(commissionBalance);
  const threshold = money(minimumRequired);
  return balance >= threshold
    ? { allowed: true, reason: 'SUFFICIENT_COMMISSION_BALANCE' }
    : { allowed: false, reason: 'LOW_COMMISSION_BALANCE', shortfall: money(threshold - balance) };
}

export function buildPartnerEarningsDashboard({
  plan,
  todayTrips = [],
  commissionBalance = 0,
  earningsBalance = 0,
  pendingPayout = 0,
  subscriptionValidUntil = null,
  now = new Date(),
}) {
  const completed = todayTrips.filter(t => t.status === 'COMPLETED');
  const todayGross = money(completed.reduce((sum, t) => sum + Number(t.totalCustomerAmount || 0), 0));
  const todayPartnerEarnings = money(completed.reduce((sum, t) => sum + Number(t.partnerEarning || 0), 0));
  const todayCommission = money(completed.reduce((sum, t) => sum + Number(t.platformCommission || 0), 0));

  return {
    plan,
    completedTripsToday: completed.length,
    todayGross,
    todayPartnerEarnings,
    todayCommission,
    commissionBalance: money(commissionBalance),
    earningsBalance: money(earningsBalance),
    pendingPayout: money(pendingPayout),
    availableForPayout: money(Math.max(0, Number(earningsBalance || 0) - Number(pendingPayout || 0))),
    subscription: subscriptionStatus({ plan, validUntil: subscriptionValidUntil, now }),
  };
}

export function createPayoutRequest({ earningsBalance, pendingPayout = 0, amount, minimumPayout = 100 }) {
  const requested = money(amount);
  const available = money(Math.max(0, Number(earningsBalance || 0) - Number(pendingPayout || 0)));
  if (requested < minimumPayout) return { allowed: false, reason: 'BELOW_MINIMUM_PAYOUT', available };
  if (requested > available) return { allowed: false, reason: 'INSUFFICIENT_AVAILABLE_EARNINGS', available };
  return { allowed: true, amount: requested, availableBefore: available, availableAfter: money(available - requested) };
}
