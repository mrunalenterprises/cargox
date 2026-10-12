export const SERVICE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  COMING_SOON: 'COMING_SOON',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
});

export const SERVICE_CODE = Object.freeze({
  PARCEL_2W: 'PARCEL_2W',
  LOADING_VEHICLE: 'LOADING_VEHICLE',
  HELPER: 'HELPER',
  FULL_SHIFTING: 'FULL_SHIFTING',
});

export function normalizeCityCode(value = '') {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function resolveServiceAvailability({ city, serviceCode, vehicleType = null, zoneCode = null }) {
  if (!city?.enabled) return { available: false, status: SERVICE_STATUS.DISABLED, reason: 'CITY_DISABLED' };

  const config = (city.services || []).find(s => s.serviceCode === serviceCode);
  if (!config) return { available: false, status: SERVICE_STATUS.COMING_SOON, reason: 'SERVICE_NOT_CONFIGURED' };
  if (config.status !== SERVICE_STATUS.ACTIVE) {
    return { available: false, status: config.status, reason: config.status };
  }

  if (zoneCode && Array.isArray(config.allowedZones) && config.allowedZones.length > 0 && !config.allowedZones.includes(zoneCode)) {
    return { available: false, status: SERVICE_STATUS.PAUSED, reason: 'ZONE_NOT_SERVED' };
  }

  if (vehicleType && Array.isArray(config.allowedVehicleTypes) && config.allowedVehicleTypes.length > 0 && !config.allowedVehicleTypes.includes(vehicleType)) {
    return { available: false, status: SERVICE_STATUS.PAUSED, reason: 'VEHICLE_NOT_AVAILABLE' };
  }

  return {
    available: true,
    status: SERVICE_STATUS.ACTIVE,
    reason: null,
    serviceCode,
    cityCode: city.code,
  };
}

export function serviceCardState(input) {
  const result = resolveServiceAvailability(input);
  if (result.available) return { enabled: true, badge: null, cta: 'Book Now' };
  if (result.status === SERVICE_STATUS.COMING_SOON) return { enabled: false, badge: 'Coming Soon', cta: 'Coming Soon' };
  if (result.status === SERVICE_STATUS.PAUSED) return { enabled: false, badge: 'Temporarily Unavailable', cta: 'Unavailable' };
  return { enabled: false, badge: 'Unavailable', cta: 'Unavailable' };
}

export function zoneContainsPoint(zone, point) {
  if (!zone || !point) return false;
  const { minLat, maxLat, minLng, maxLng } = zone;
  return point.lat >= minLat && point.lat <= maxLat && point.lng >= minLng && point.lng <= maxLng;
}

export function findOperatingZone(zones = [], point) {
  return zones.find(zone => zone.enabled !== false && zoneContainsPoint(zone, point)) || null;
}

export function canCreateBooking({ city, serviceCode, pickup, drop, vehicleType }) {
  const pickupZone = findOperatingZone(city?.zones || [], pickup);
  const dropZone = findOperatingZone(city?.zones || [], drop);

  if (!pickupZone) return { allowed: false, reason: 'PICKUP_OUTSIDE_SERVICE_AREA' };
  if (!dropZone && !city?.allowOutstationDrop) return { allowed: false, reason: 'DROP_OUTSIDE_SERVICE_AREA' };

  const availability = resolveServiceAvailability({
    city,
    serviceCode,
    vehicleType,
    zoneCode: pickupZone.code,
  });

  if (!availability.available) return { allowed: false, reason: availability.reason };

  return {
    allowed: true,
    pickupZoneCode: pickupZone.code,
    dropZoneCode: dropZone?.code || null,
    availability,
  };
}

export function cityServiceSummary(city) {
  const services = city?.services || [];
  return {
    cityCode: city?.code || null,
    cityEnabled: Boolean(city?.enabled),
    active: services.filter(s => s.status === SERVICE_STATUS.ACTIVE).map(s => s.serviceCode),
    comingSoon: services.filter(s => s.status === SERVICE_STATUS.COMING_SOON).map(s => s.serviceCode),
    paused: services.filter(s => s.status === SERVICE_STATUS.PAUSED).map(s => s.serviceCode),
  };
}
