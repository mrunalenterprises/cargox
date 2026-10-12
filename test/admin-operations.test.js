import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ROLES,
  canReviewPartner,
  canApprovePricing,
  canManagePayouts,
  validatePricingRule,
  liveOpsRiskFlags,
  adminDashboardCounters,
} from '../src/domain/admin-operations.js';

test('admin role permissions are scoped', () => {
  assert.equal(canReviewPartner(ADMIN_ROLES.FIELD_OFFICER), true);
  assert.equal(canApprovePricing(ADMIN_ROLES.FIELD_OFFICER), false);
  assert.equal(canManagePayouts(ADMIN_ROLES.ACCOUNTS), true);
});

test('pricing rule rejects missing or negative values', () => {
  assert.equal(validatePricingRule({ cityCode: 'CSN' }).ok, false);
  const valid = validatePricingRule({
    cityCode: 'CSN', serviceType: 'LOADING_VEHICLE', vehicleClass: 'TATA_ACE',
    baseFare: 250, includedKm: 1, includedMinutes: 60, extraKmRate: 20, extraMinuteRate: 2,
  });
  assert.equal(valid.ok, true);
});

test('live operations raises breakdown and delay flags', () => {
  const flags = liveOpsRiskFlags({
    status: 'REPLACEMENT_REQUIRED', supportCaseOpen: true, partnerQualityScore: 55,
  });
  assert.ok(flags.includes('BREAKDOWN_REPLACEMENT'));
  assert.ok(flags.includes('ACTIVE_SUPPORT_CASE'));
  assert.ok(flags.includes('LOW_PARTNER_QUALITY'));
});

test('dashboard counters summarize active operations', () => {
  const counters = adminDashboardCounters([
    { status: 'SEARCHING_PARTNER' },
    { status: 'REPLACEMENT_REQUIRED', supportCaseOpen: true },
    { status: 'COMPLETED', completedToday: true },
  ]);
  assert.deepEqual(counters, {
    active: 2,
    searching: 1,
    replacementRequired: 1,
    supportCases: 1,
    completedToday: 1,
  });
});
