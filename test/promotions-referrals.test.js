import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMOTION_TYPE,
  calculatePromotionDiscount,
  evaluatePromotionEligibility,
  referralRewardEligibility,
  promotionStackingDecision,
  calculateBusinessDiscount,
  applyPromotion
} from '../src/domain/promotions-referrals.js';

test('percentage promotion respects max discount', () => {
  const result = calculatePromotionDiscount({ promo: { type: PROMOTION_TYPE.PERCENTAGE, value: 20, maxDiscount: 150 }, fare: 1000 });
  assert.equal(result.discount, 150);
  assert.equal(result.finalFare, 850);
});

test('flat promotion never discounts below zero', () => {
  const result = calculatePromotionDiscount({ promo: { type: PROMOTION_TYPE.FLAT, value: 500 }, fare: 300 });
  assert.equal(result.discount, 300);
  assert.equal(result.finalFare, 0);
});

test('customer redemption limit blocks reuse', () => {
  const result = evaluatePromotionEligibility({
    promo: { code: 'SAVE100', type: PROMOTION_TYPE.FLAT, status: 'ACTIVE', value: 100, perCustomerLimit: 1 },
    fare: 1000,
    customerRedemptions: 1
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'CUSTOMER_LIMIT_REACHED');
});

test('high fraud risk blocks promotion', () => {
  const result = evaluatePromotionEligibility({
    promo: { code: 'SAVE100', type: PROMOTION_TYPE.FLAT, status: 'ACTIVE', value: 100 },
    fare: 1000,
    fraudRiskLevel: 'HIGH'
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'FRAUD_REVIEW_REQUIRED');
});

test('referral requires completed paid trip and rejects same device', () => {
  const bad = referralRewardEligibility({ referrerId: 'a', referredCustomerId: 'b', completedPaidTrips: 1, sameDevice: true });
  assert.equal(bad.eligible, false);
  assert.equal(bad.reason, 'SAME_DEVICE');

  const good = referralRewardEligibility({ referrerId: 'a', referredCustomerId: 'b', completedPaidTrips: 1 });
  assert.equal(good.eligible, true);
});

test('business discount is capped at 50 percent', () => {
  const result = calculateBusinessDiscount({ fare: 1000, discountPct: 80 });
  assert.equal(result.discount, 500);
  assert.equal(result.finalFare, 500);
});

test('promotion stacking is blocked and eligible promo applies', () => {
  const stacking = promotionStackingDecision({ couponApplied: true, referralCreditApplied: true, businessDiscountApplied: false });
  assert.equal(stacking.allowed, false);

  const applied = applyPromotion({
    promo: { type: PROMOTION_TYPE.FLAT, value: 100 },
    fare: 500,
    eligibility: { valid: true }
  });
  assert.equal(applied.applied, true);
  assert.equal(applied.finalFare, 400);
});
