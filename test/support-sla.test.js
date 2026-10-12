import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_PRIORITY,
  ESCALATION_ROLE,
  SLA_STATUS,
  deriveSupportPriority,
  evaluateSupportSla,
  nextSupportEscalation,
  buildEscalationPlan,
} from '../src/domain/support-sla.js';

test('safety incident is P0', () => {
  assert.equal(deriveSupportPriority({ safetyRisk: true }), SUPPORT_PRIORITY.P0);
});

test('active trip breakdown is P1', () => {
  assert.equal(deriveSupportPriority({ activeTrip: true, incidentType: 'BREAKDOWN' }), SUPPORT_PRIORITY.P1);
});

test('P0 first response breaches after two minutes', () => {
  const openedAt = '2026-10-12T10:00:00Z';
  const now = '2026-10-12T10:03:00Z';
  const result = evaluateSupportSla({ priority: SUPPORT_PRIORITY.P0, openedAt, now });
  assert.equal(result.status, SLA_STATUS.RESPONSE_BREACHED);
});

test('P1 escalates to GM at fifteen minutes', () => {
  const result = nextSupportEscalation({
    priority: SUPPORT_PRIORITY.P1,
    openedAt: '2026-10-12T10:00:00Z',
    now: '2026-10-12T10:15:00Z',
    currentRole: ESCALATION_ROLE.SUPPORT,
  });
  assert.equal(result.escalate, true);
  assert.equal(result.toRole, ESCALATION_ROLE.GM);
});

test('P1 escalates to Super Admin at thirty minutes', () => {
  const result = nextSupportEscalation({
    priority: SUPPORT_PRIORITY.P1,
    openedAt: '2026-10-12T10:00:00Z',
    now: '2026-10-12T10:30:00Z',
    currentRole: ESCALATION_ROLE.GM,
  });
  assert.equal(result.toRole, ESCALATION_ROLE.SUPER_ADMIN);
});

test('safety risk immediately routes to safety', () => {
  const result = nextSupportEscalation({
    priority: SUPPORT_PRIORITY.P0,
    openedAt: '2026-10-12T10:00:00Z',
    now: '2026-10-12T10:00:00Z',
    currentRole: ESCALATION_ROLE.SUPPORT,
    safetyRisk: true,
  });
  assert.equal(result.toRole, ESCALATION_ROLE.SAFETY);
});

test('escalation plan marks P0/P1 as active-trip human support', () => {
  const plan = buildEscalationPlan({ priority: SUPPORT_PRIORITY.P1, openedAt: '2026-10-12T10:00:00Z' });
  assert.equal(plan.activeTripHumanSupport, true);
  assert.equal(plan.gmEscalateAt, '2026-10-12T10:15:00.000Z');
});
