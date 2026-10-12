import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySOS, fraudRiskScore, fraudDecision, routeDeviationAlert, shareLinkStatus, shouldAutoSuspend } from '../src/domain/safety-fraud.js';

test('critical SOS reasons require human escalation', () => {
  const result = classifySOS({ source: 'customer', reason: 'accident', tripActive: true });
  assert.equal(result.severity, 'CRITICAL');
  assert.equal(result.requiresHumanEscalation, true);
});

test('active trip non-critical SOS is at least high priority', () => {
  const result = classifySOS({ source: 'partner', reason: 'other', tripActive: true });
  assert.equal(result.severity, 'HIGH');
});

test('share link expires and can be revoked', () => {
  assert.equal(shareLinkStatus({ expiresAt: '2030-01-01T00:00:00Z', now: '2029-01-01T00:00:00Z' }), 'ACTIVE');
  assert.equal(shareLinkStatus({ expiresAt: '2028-01-01T00:00:00Z', now: '2029-01-01T00:00:00Z' }), 'EXPIRED');
  assert.equal(shareLinkStatus({ expiresAt: '2030-01-01T00:00:00Z', now: '2029-01-01T00:00:00Z', revokedAt: '2029-01-01T01:00:00Z' }), 'REVOKED');
});

test('multiple strong fraud signals produce critical decision', () => {
  const score = fraudRiskScore({ gpsJumpKm: 5, gpsJumpSeconds: 30, repeatedDeviceAccounts: 4, paymentChargebackCount90d: 3, duplicateProofHash: true });
  const decision = fraudDecision(score);
  assert.ok(score >= 70);
  assert.equal(decision.action, 'BLOCK_AND_REVIEW');
});

test('normal behavior remains low risk', () => {
  const score = fraudRiskScore({ repeatedDeviceAccounts: 1, customerCancellationRate: 5, partnerPostAcceptCancellationRate: 1 });
  assert.equal(score, 0);
  assert.equal(fraudDecision(score).action, 'ALLOW');
});

test('route deviation requires sustained off-route behavior', () => {
  assert.equal(routeDeviationAlert({ plannedDistanceFromRouteM: 1200, sustainedSeconds: 60 }).deviated, false);
  assert.equal(routeDeviationAlert({ plannedDistanceFromRouteM: 1200, sustainedSeconds: 180 }).deviated, true);
});

test('confirmed document fraud can auto suspend', () => {
  assert.equal(shouldAutoSuspend({ documentFraudConfirmed: true }), true);
  assert.equal(shouldAutoSuspend({ fraudScore: 20, unresolvedCriticalIncidents: 0 }), false);
});
