import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TYPE,
  PRIORITY,
  bookingAlertPayload,
  scheduledReminderPlan,
  documentExpiryAlert,
  highDemandAlert,
  shouldDeliverNotification,
  alertEscalation,
} from '../src/domain/notification-engine.js';

test('booking alert includes partner earning and 20-second response window', () => {
  const alert = bookingAlertPayload({
    bookingId: 'b1', pickup: 'A', drop: 'B', pickupDistanceKm: 2.4,
    tripDistanceKm: 12, service: 'Loading Vehicle', customerFare: 1000,
    partnerEarning: 850,
  });
  assert.equal(alert.type, NOTIFICATION_TYPE.BOOKING_ALERT);
  assert.equal(alert.priority, PRIORITY.HIGH);
  assert.equal(alert.partnerEarning, 850);
  assert.equal(alert.responseSeconds, 20);
  assert.equal(alert.vibration, true);
});

test('replacement alert is critical', () => {
  const alert = bookingAlertPayload({
    bookingId: 'b2', pickup: 'Breakdown point', drop: 'Destination', service: 'Loading Vehicle',
    customerFare: 1000, partnerEarning: 510, isReplacement: true,
  });
  assert.equal(alert.type, NOTIFICATION_TYPE.REPLACEMENT);
  assert.equal(alert.priority, PRIORITY.CRITICAL);
});

test('scheduled reminders are generated only in the future', () => {
  const now = new Date('2026-10-12T10:00:00Z');
  const reminders = scheduledReminderPlan({ scheduledFor: '2026-10-12T12:00:00Z', now, reminderMinutes: [60, 15] });
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].minutesBefore, 60);
  assert.equal(reminders[1].minutesBefore, 15);
});

test('expired document blocks partner from online availability', () => {
  const alert = documentExpiryAlert({ documentType: 'Insurance', expiresAt: '2026-10-10T00:00:00Z', now: '2026-10-12T00:00:00Z' });
  assert.equal(alert.state, 'EXPIRED');
  assert.equal(alert.blocksOnline, true);
  assert.equal(alert.priority, PRIORITY.CRITICAL);
});

test('high demand alert fires only above threshold', () => {
  const low = highDemandAlert({ demandIndex: 20, onlinePartners: 10, openBookings: 2, areaName: 'CIDCO', service: 'Parcel' });
  const high = highDemandAlert({ demandIndex: 95, onlinePartners: 2, openBookings: 18, areaName: 'CIDCO', service: 'Parcel' });
  assert.equal(low, null);
  assert.ok(high.score >= 60);
});

test('quiet hours suppress non-critical demand alerts but not replacement', () => {
  assert.equal(shouldDeliverNotification({ type: NOTIFICATION_TYPE.HIGH_DEMAND, quietHours: true }), false);
  assert.equal(shouldDeliverNotification({ type: NOTIFICATION_TYPE.REPLACEMENT, quietHours: true }), true);
});

test('booking alert escalates through waves and then operations', () => {
  assert.deepEqual(alertEscalation({ elapsedSeconds: 10, responseSeconds: 20, currentWave: 1 }), { action: 'WAIT', wave: 1 });
  assert.deepEqual(alertEscalation({ elapsedSeconds: 20, responseSeconds: 20, currentWave: 1 }), { action: 'REBROADCAST', wave: 2 });
  assert.deepEqual(alertEscalation({ elapsedSeconds: 20, responseSeconds: 20, currentWave: 4, maxWaves: 4 }), { action: 'NO_PARTNER_ESCALATION', wave: 4 });
});
