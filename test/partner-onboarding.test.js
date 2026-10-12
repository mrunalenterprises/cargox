import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingCompletion, reviewStage, canGoOnline, documentExpiryState, eligibilityFromDocs } from '../src/domain/partner-onboarding.js';

test('onboarding completion reaches 100 when all required items are approved', () => {
  const personalDocs = Object.fromEntries(['aadhaar','pan','driving_licence','bank_proof'].map(k => [k,{status:'APPROVED'}]));
  const vehicleDocs = Object.fromEntries(['rc','insurance','puc','fitness','permit'].map(k => [k,{status:'APPROVED'}]));
  assert.equal(onboardingCompletion({ personalDocs, vehicleDocs, selfieVerified:true, bankVerified:true }), 100);
});

test('review stage moves from staff to admin to active', () => {
  assert.equal(reviewStage({staffApproved:false}), 'STAFF_REVIEW');
  assert.equal(reviewStage({staffApproved:true}), 'ADMIN_REVIEW');
  assert.equal(reviewStage({staffApproved:true, adminDecision:'APPROVED'}), 'ACTIVE_OFFLINE');
});

test('go online requires active onboarding, fresh identity match and eligible vehicle', () => {
  assert.equal(canGoOnline({onboardingStatus:'ACTIVE_OFFLINE', identitySelfieMatched:true, vehicleEligible:true}), true);
  assert.equal(canGoOnline({onboardingStatus:'ACTIVE_OFFLINE', identitySelfieMatched:false, vehicleEligible:true}), false);
});

test('expiry alerts identify soon-to-expire and expired documents', () => {
  const now = new Date('2026-10-12T00:00:00Z');
  assert.equal(documentExpiryState('2026-11-20', now), 'VALID');
  assert.equal(documentExpiryState('2026-10-30', now), 'EXPIRING_SOON');
  assert.equal(documentExpiryState('2026-10-15', now), 'CRITICAL');
  assert.equal(documentExpiryState('2026-10-01', now), 'EXPIRED');
  const e = eligibilityFromDocs({rc:{expiryDate:'2026-10-01'}}, now);
  assert.equal(e.eligible, false);
  assert.equal(e.hasExpired, true);
});
