import test from 'node:test';
import assert from 'node:assert/strict';
import {
  waitingCharge,
  noShowDecision,
  aiPriceGuard,
  extraChargeApproval,
  cancellationOutcome,
} from '../src/domain/waiting-extra-charges.js';

test('waiting charge starts after free period', () => {
  const r = waitingCharge({
    arrivedAt: '2026-10-12T10:00:00Z',
    departedAt: '2026-10-12T10:18:00Z',
    freeMinutes: 10,
    ratePerMinute: 3,
  });
  assert.equal(r.chargeableMinutes, 8);
  assert.equal(r.amount, 24);
});

test('waiting within free period has zero charge', () => {
  const r = waitingCharge({
    arrivedAt: '2026-10-12T10:00:00Z',
    departedAt: '2026-10-12T10:08:00Z',
  });
  assert.equal(r.amount, 0);
});

test('no-show needs threshold and contact attempts', () => {
  assert.equal(noShowDecision({ waitedMinutes: 15, customerContactAttempts: 2 }).eligible, true);
  assert.equal(noShowDecision({ waitedMinutes: 15, customerContactAttempts: 1 }).eligible, false);
});

test('AI price guard allows small variance', () => {
  const r = aiPriceGuard({ type: 'TOLL', requestedAmount: 115, expectedAmount: 100, tolerancePct: 20 });
  assert.equal(r.status, 'ALLOW');
});

test('AI price guard sends large variance to review', () => {
  const r = aiPriceGuard({ type: 'PARKING', requestedAmount: 180, expectedAmount: 100, tolerancePct: 20 });
  assert.equal(r.status, 'REVIEW');
});

test('toll approval requires customer approval and evidence', () => {
  const guard = aiPriceGuard({ type: 'TOLL', requestedAmount: 110, expectedAmount: 100 });
  assert.equal(extraChargeApproval({ type: 'TOLL', requestedAmount: 110, guardResult: guard, customerApproved: true, evidenceProvided: false }).state, 'EVIDENCE_REQUIRED');
  assert.equal(extraChargeApproval({ type: 'TOLL', requestedAmount: 110, guardResult: guard, customerApproved: true, evidenceProvided: true }).approved, true);
});

test('partner fault cancellation never penalizes customer', () => {
  assert.equal(cancellationOutcome({ actor: 'partner', fault: 'PARTNER' }).code, 'NO_CUSTOMER_PENALTY');
});
