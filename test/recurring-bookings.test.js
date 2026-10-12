import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecurringPlan, generateOccurrences, shouldSendReminder, canReuseRoute, businessRepeatRouteLabel } from '../src/domain/recurring-bookings.js';

const basePlan = {
  customerId:'c1', serviceType:'loading_vehicle', pickup:'A', drop:'B',
  startDate:'2026-10-12', endDate:'2026-10-18', weekdays:[1,3,5], pickupTime:'09:00',
  returnEnabled:true, returnTime:'18:00'
};

test('valid recurring plan passes validation', () => {
  assert.equal(validateRecurringPlan(basePlan).valid, true);
});

test('missing return time is rejected', () => {
  const result = validateRecurringPlan({...basePlan, returnTime:null});
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('return_time_required'));
});

test('generator creates outbound and return legs', () => {
  const rows = generateOccurrences(basePlan, '2026-10-12', '2026-10-18');
  assert.ok(rows.length >= 2);
  assert.ok(rows.some(r => r.leg === 'OUTBOUND'));
  assert.ok(rows.some(r => r.leg === 'RETURN'));
});

test('reminder fires only inside lead window', () => {
  const now = new Date('2026-10-12T08:15:00Z');
  assert.equal(shouldSendReminder({scheduledAt:'2026-10-12T09:00:00Z', now, leadMinutes:60}), true);
  assert.equal(shouldSendReminder({scheduledAt:'2026-10-12T11:00:00Z', now, leadMinutes:60}), false);
});

test('route reuse requires exact stored coordinates', () => {
  const a = {pickupLat:1,pickupLng:2,dropLat:3,dropLng:4};
  assert.equal(canReuseRoute({existing:a,next:{...a}}), true);
  assert.equal(canReuseRoute({existing:a,next:{...a,dropLng:5}}), false);
});

test('business repeat route label uses friendly route text', () => {
  assert.equal(businessRepeatRouteLabel({pickupLabel:'CIDCO',dropLabel:'Waluj'}), 'CIDCO → Waluj');
  assert.equal(businessRepeatRouteLabel({name:'Daily Factory Run',pickupLabel:'A',dropLabel:'B'}), 'Daily Factory Run');
});
