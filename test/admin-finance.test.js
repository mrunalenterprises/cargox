import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCommissionRevenue,
  calculateSubscriptionRevenue,
  reconcilePayout,
  buildFinanceDashboard,
  financeAlertFlags,
  RECON_STATUS,
} from '../src/domain/admin-finance.js';

test('commission revenue keeps gateway cost inside platform commission', () => {
  const result = calculateCommissionRevenue({ commissionableFare: 1000, commissionRatePct: 15, gatewayFee: 20 });
  assert.equal(result.grossCommission, 150);
  assert.equal(result.netCommissionRevenue, 130);
});

test('subscription revenue counts only paid subscriptions', () => {
  const result = calculateSubscriptionRevenue({ subscriptions: [
    { status: 'PAID', amount: 1180, taxAmount: 180 },
    { status: 'PENDING', amount: 1180, taxAmount: 180 },
  ] });
  assert.equal(result.paidCount, 1);
  assert.equal(result.subscriptionRevenueBeforeTax, 1000);
});

test('matched payout reconciliation within tolerance', () => {
  const result = reconcilePayout({ expectedAmount: 1000, settledAmount: 999.5, tolerance: 1 });
  assert.equal(result.status, RECON_STATUS.MATCHED);
});

test('partial payout reconciliation detected', () => {
  const result = reconcilePayout({ expectedAmount: 1000, settledAmount: 700, tolerance: 1 });
  assert.equal(result.status, RECON_STATUS.PARTIAL);
});

test('finance dashboard calculates net platform revenue', () => {
  const result = buildFinanceDashboard({
    completedTrips: 10,
    grossBookingValue: 10000,
    commissionGross: 1500,
    subscriptionRevenue: 500,
    gatewayFees: 100,
    refunds: 50,
    goodwillCredits: 25,
    operatingAdjustments: 25,
  });
  assert.equal(result.platformGrossRevenue, 2000);
  assert.equal(result.platformNetRevenue, 1800);
});

test('finance alerts surface payout and reconciliation risk', () => {
  const dashboard = buildFinanceDashboard({ commissionGross: 1000, pendingPayouts: 500 });
  const flags = financeAlertFlags({ dashboard, unreconciledCount: 2, negativeWalletPartners: 1 });
  assert.ok(flags.includes('PAYOUTS_PENDING'));
  assert.ok(flags.includes('RECONCILIATION_PENDING'));
  assert.ok(flags.includes('NEGATIVE_COMMISSION_BALANCE'));
});

test('negative net revenue raises alert', () => {
  const dashboard = buildFinanceDashboard({ commissionGross: 100, gatewayFees: 150 });
  const flags = financeAlertFlags({ dashboard });
  assert.ok(flags.includes('NEGATIVE_NET_REVENUE'));
});
