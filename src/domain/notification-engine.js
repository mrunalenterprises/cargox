export const NOTIFICATION_TYPE = Object.freeze({
  BOOKING_ALERT: 'BOOKING_ALERT',
  SCHEDULED_REMINDER: 'SCHEDULED_REMINDER',
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
  HIGH_DEMAND: 'HIGH_DEMAND',
  RETURN_LOAD: 'RETURN_LOAD',
  REPLACEMENT: 'REPLACEMENT',
  SUPPORT_UPDATE: 'SUPPORT_UPDATE',
});

export const PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function bookingAlertPayload({
  bookingId,
  pickup,
  drop,
  pickupDistanceKm,
  tripDistanceKm,
  service,
  customerFare,
  partnerEarning,
  scheduledFor = null,
  isReturnLoad = false,
  isReplacement = false,
  soundKey = 'loadin_booking_alert',
  responseSeconds = 20,
}) {
  if (!bookingId) throw new Error('bookingId required');
  if (!pickup || !drop) throw new Error('pickup and drop required');
  if (!service) throw new Error('service required');
  if (!(customerFare >= 0) || !(partnerEarning >= 0)) throw new Error('invalid fare');

  return {
    type: isReplacement ? NOTIFICATION_TYPE.REPLACEMENT : isReturnLoad ? NOTIFICATION_TYPE.RETURN_LOAD : NOTIFICATION_TYPE.BOOKING_ALERT,
    priority: isReplacement ? PRIORITY.CRITICAL : PRIORITY.HIGH,
    bookingId,
    pickup,
    drop,
    pickupDistanceKm: Number(pickupDistanceKm || 0),
    tripDistanceKm: Number(tripDistanceKm || 0),
    service,
    customerFare: Number(customerFare),
    partnerEarning: Number(partnerEarning),
    bookingMode: scheduledFor ? 'SCHEDULED' : 'NOW',
    scheduledFor,
    responseSeconds: clamp(Number(responseSeconds || 20), 10, 60),
    soundKey,
    vibration: true,
    headsUp: true,
  };
}

export function scheduledReminderPlan({ scheduledFor, now = new Date(), reminderMinutes = [60, 15] }) {
  const target = new Date(scheduledFor);
  const current = new Date(now);
  if (Number.isNaN(target.getTime())) throw new Error('invalid scheduledFor');
  if (target <= current) return [];

  return [...new Set(reminderMinutes)]
    .filter((m) => Number.isFinite(m) && m > 0)
    .map((minutesBefore) => ({
      type: NOTIFICATION_TYPE.SCHEDULED_REMINDER,
      minutesBefore,
      sendAt: new Date(target.getTime() - minutesBefore * 60000),
    }))
    .filter((r) => r.sendAt > current)
    .sort((a, b) => a.sendAt - b.sendAt);
}

export function documentExpiryAlert({ documentType, expiresAt, now = new Date() }) {
  const expiry = new Date(expiresAt);
  const current = new Date(now);
  if (Number.isNaN(expiry.getTime())) throw new Error('invalid expiresAt');
  const daysRemaining = Math.ceil((expiry - current) / 86400000);

  if (daysRemaining < 0) {
    return {
      type: NOTIFICATION_TYPE.DOCUMENT_EXPIRY,
      priority: PRIORITY.CRITICAL,
      daysRemaining,
      documentType,
      state: 'EXPIRED',
      blocksOnline: true,
    };
  }
  if (daysRemaining <= 7) {
    return {
      type: NOTIFICATION_TYPE.DOCUMENT_EXPIRY,
      priority: PRIORITY.HIGH,
      daysRemaining,
      documentType,
      state: 'EXPIRING_SOON',
      blocksOnline: false,
    };
  }
  if (daysRemaining <= 30) {
    return {
      type: NOTIFICATION_TYPE.DOCUMENT_EXPIRY,
      priority: PRIORITY.NORMAL,
      daysRemaining,
      documentType,
      state: 'REMINDER',
      blocksOnline: false,
    };
  }
  return null;
}

export function highDemandAlert({ demandIndex, onlinePartners, openBookings, areaName, service }) {
  const demand = Number(demandIndex || 0);
  const supply = Math.max(0, Number(onlinePartners || 0));
  const bookings = Math.max(0, Number(openBookings || 0));
  const pressure = supply === 0 ? bookings * 10 : (bookings / supply) * 10;
  const score = clamp(Math.round(demand * 0.6 + pressure * 0.4), 0, 100);

  if (score < 60) return null;
  return {
    type: NOTIFICATION_TYPE.HIGH_DEMAND,
    priority: score >= 85 ? PRIORITY.HIGH : PRIORITY.NORMAL,
    score,
    areaName,
    service,
    message: score >= 85 ? 'Very high demand nearby — go online for more booking opportunities.' : 'Demand is rising nearby.',
  };
}

export function shouldDeliverNotification({ muted = false, type, partnerOnline = true, quietHours = false }) {
  if (type === NOTIFICATION_TYPE.REPLACEMENT) return true;
  if (type === NOTIFICATION_TYPE.BOOKING_ALERT && !partnerOnline) return false;
  if (muted && [NOTIFICATION_TYPE.HIGH_DEMAND, NOTIFICATION_TYPE.DOCUMENT_EXPIRY].includes(type)) return false;
  if (quietHours && [NOTIFICATION_TYPE.HIGH_DEMAND, NOTIFICATION_TYPE.DOCUMENT_EXPIRY].includes(type)) return false;
  return true;
}

export function alertEscalation({ elapsedSeconds, responseSeconds = 20, currentWave = 1, maxWaves = 4 }) {
  if (elapsedSeconds < responseSeconds) return { action: 'WAIT', wave: currentWave };
  if (currentWave < maxWaves) return { action: 'REBROADCAST', wave: currentWave + 1 };
  return { action: 'NO_PARTNER_ESCALATION', wave: currentWave };
}
