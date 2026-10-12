import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNER_PLAN, PAYMENT_METHOD, calculateTripSettlement, subscriptionStatus,
  cashBookingEligibility, buildPartnerEarningsDashboard, createPayoutRequest
} from '../src/domain/partner-earnings-dashboard.js';

test('subscription partner keeps full direct payment with zero commission', () => {
  const s = calculateTripSettlement({ plan: PARTNER_PLAN.SUBSCRIPTION, paymentMethod: PAYMENT_METHOD.CASH, commissionableFare: 1000, passthroughAmount: 100 });
  assert.equal(s.platformCommission, 0);
  assert.equal(s.partnerDirectReceipt, 1100);
});

test('commission cash trip debits commission balance by 15 percent', () => {
  const s = calculateTripSettlement({ plan: PARTNER_PLAN.COMMISSION, paymentMethod: PAYMENT_METHOD.CASH, commissionableFare: 1000, passthroughAmount: 100 });
  assert.equal(s.platformCommission, 150);
  assert.equal(s.commissionBalanceDelta, -150);
  assert.equal(s.partnerDirectReceipt, 1100);
});

test('commission online trip credits earnings balance and gateway cost stays with platform', () => {
  const s = calculateTripSettlement({ plan: PARTNER_PLAN.COMMISSION, paymentMethod: PAYMENT_METHOD.ONLINE, commissionableFare: 1000, passthroughAmount: 100, gatewayCost: 23.6 });
  assert.equal(s.earningsBalanceDelta, 950);
  assert.equal(s.platformNetCommission, 126.4);
});

test('subscription status reports active and days left', () => {
  const s = subscriptionStatus({ plan: PARTNER_PLAN.SUBSCRIPTION, validUntil: '2026-10-20T00:00:00Z', now: new Date('2026-10-12T00:00:00Z') });
  assert.equal(s.active, true);
  assert.equal(s.daysLeft, 8);
});

test('low commission balance blocks commission-plan cash bookings', () => {
  const e = cashBookingEligibility({ plan: PARTNER_PLAN.COMMISSION, commissionBalance: 80, minimumRequired: 150 });
  assert.equal(e.allowed, false);
  assert.equal(e.shortfall, 70);
});

test('dashboard aggregates completed trips and payout availability', () => {
  const d = buildPartnerEarningsDashboard({
    plan: PARTNER_PLAN.COMMISSION,
    todayTrips: [
      { status: 'COMPLETED', totalCustomerAmount: 1000, partnerEarning: 850, platformCommission: 150 },
      { status: 'CANCELLED', totalCustomerAmount: 500, partnerEarning: 0, platformCommission: 0 },
      { status: 'COMPLETED', totalCustomerAmount: 600, partnerEarning: 510, platformCommission: 90 },
    ],
    commissionBalance: 500, earningsBalance: 2000, pendingPayout: 700,
  });
  assert.equal(d.completedTripsToday, 2);
  assert.equal(d.todayPartnerEarnings, 1360);
  assert.equal(d.availableForPayout, 1300);
});

test('payout request validates minimum and available earnings', () => {
  assert.equal(createPayoutRequest({ earningsBalance: 500, amount: 50 }).reason, 'BELOW_MINIMUM_PAYOUT');
  assert.equal(createPayoutRequest({ earningsBalance: 500, pendingPayout: 100, amount: 450 }).reason, 'INSUFFICIENT_AVAILABLE_EARNINGS');
  assert.equal(createPayoutRequest({ earningsBalance: 500, pendingPayout: 100, amount: 300 }).allowed, true);
});
