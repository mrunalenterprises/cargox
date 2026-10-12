import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGstin, canBusinessMember, buildBusinessStatement, billingName } from '../src/domain/business-accounts.js';

test('validates normalized GSTIN format', () => {
  assert.equal(isValidGstin('27ABCDE1234F1Z5'), true);
  assert.equal(isValidGstin('27abcde1234f1z5'), true);
  assert.equal(isValidGstin('BADGST'), false);
});

test('owner can manage company and staff', () => {
  assert.equal(canBusinessMember('OWNER','manage_company'), true);
  assert.equal(canBusinessMember('OWNER','manage_staff'), true);
});

test('booker cannot manage staff', () => {
  assert.equal(canBusinessMember('BOOKER','book'), true);
  assert.equal(canBusinessMember('BOOKER','manage_staff'), false);
});

test('viewer cannot create bookings', () => {
  assert.equal(canBusinessMember('VIEWER','view_billing'), true);
  assert.equal(canBusinessMember('VIEWER','book'), false);
});

test('monthly statement includes completed bookings only', () => {
  const s = buildBusinessStatement({
    month:'2026-10',
    bookings:[
      {status:'completed', grossFare:1000, taxAmount:50},
      {status:'cancelled', grossFare:800, taxAmount:40},
      {status:'completed', grossFare:500, taxAmount:25},
    ],
    adjustments:[{type:'credit',amount:100},{type:'debit',amount:20}],
  });
  assert.equal(s.bookingCount, 2);
  assert.equal(s.grossFare, 1500);
  assert.equal(s.amountDue, 1495);
});

test('billing name prefers legal name', () => {
  assert.equal(billingName({legalName:'Mrunal Technologies Private Limited', tradeName:'LOADIN'}), 'Mrunal Technologies Private Limited');
});
