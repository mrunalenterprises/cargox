import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupportCase,
  canCreateAnotherCaseForBooking,
  assignCaseOwner,
  resolutionEligibility,
  calculateCustomerRemedy,
  refundApprovalLevel,
  SUPPORT_STATUS,
} from '../src/domain/support-disputes.js';

test('active trip issue becomes urgent', () => {
  const c = buildSupportCase({ bookingId: 'b1', customerId: 'c1', category: 'DRIVER_NO_SHOW', isActiveTrip: true });
  assert.equal(c.priority, 'URGENT');
  assert.equal(c.status, 'OPEN');
});

test('one-trip-one-ticket blocks second open case', () => {
  assert.equal(canCreateAnotherCaseForBooking([{ status: SUPPORT_STATUS.OPEN }]), false);
  assert.equal(canCreateAnotherCaseForBooking([{ status: SUPPORT_STATUS.RESOLVED }]), true);
});

test('case owner assignment moves open case to in review', () => {
  const c = buildSupportCase({ bookingId: 'b1', category: 'PAYMENT' });
  const assigned = assignCaseOwner(c, 'staff-1');
  assert.equal(assigned.caseOwnerId, 'staff-1');
  assert.equal(assigned.status, SUPPORT_STATUS.IN_REVIEW);
});

test('resolution requires owner code and notes', () => {
  assert.equal(resolutionEligibility({ status: SUPPORT_STATUS.IN_REVIEW, caseOwnerId: 's1', resolutionCode: 'REFUND', notes: 'resolved' }).ok, true);
  assert.equal(resolutionEligibility({ status: SUPPORT_STATUS.IN_REVIEW, caseOwnerId: null, resolutionCode: '', notes: '' }).ok, false);
});

test('service not delivered returns full refund', () => {
  const r = calculateCustomerRemedy({ issueType: 'SERVICE_NOT_DELIVERED', farePaid: 1200 });
  assert.equal(r.refundAmount, 1200);
  assert.equal(r.action, 'FULL_REFUND');
});

test('overcharge refund is limited to paid fare', () => {
  const r = calculateCustomerRemedy({ issueType: 'OVERCHARGE', farePaid: 500, affectedFare: 900 });
  assert.equal(r.refundAmount, 500);
  assert.equal(r.action, 'PARTIAL_REFUND');
});

test('refund approval escalates by amount', () => {
  assert.equal(refundApprovalLevel(400), 'SUPPORT');
  assert.equal(refundApprovalLevel(1500), 'GM');
  assert.equal(refundApprovalLevel(5000), 'SUPER_ADMIN');
});
