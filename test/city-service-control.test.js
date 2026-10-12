import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_STATUS,
  resolveServiceAvailability,
  serviceCardState,
  canCreateBooking,
  cityServiceSummary,
} from '../src/domain/city-service-control.js';

const city = {
  code: 'CSN',
  enabled: true,
  allowOutstationDrop: false,
  zones: [
    { code: 'CENTRAL', enabled: true, minLat: 19.80, maxLat: 19.95, minLng: 75.25, maxLng: 75.45 },
  ],
  services: [
    { serviceCode: 'PARCEL_2W', status: SERVICE_STATUS.ACTIVE, allowedVehicleTypes: ['BIKE'], allowedZones: ['CENTRAL'] },
    { serviceCode: 'LOADING_VEHICLE', status: SERVICE_STATUS.COMING_SOON, allowedVehicleTypes: ['TATA_ACE'] },
    { serviceCode: 'HELPER', status: SERVICE_STATUS.PAUSED },
  ],
};

test('active city service is available for matching vehicle and zone', () => {
  const r = resolveServiceAvailability({ city, serviceCode: 'PARCEL_2W', vehicleType: 'BIKE', zoneCode: 'CENTRAL' });
  assert.equal(r.available, true);
  assert.equal(r.status, 'ACTIVE');
});

test('coming soon service returns disabled card state', () => {
  const card = serviceCardState({ city, serviceCode: 'LOADING_VEHICLE', vehicleType: 'TATA_ACE' });
  assert.equal(card.enabled, false);
  assert.equal(card.badge, 'Coming Soon');
});

test('vehicle mismatch blocks booking', () => {
  const r = resolveServiceAvailability({ city, serviceCode: 'PARCEL_2W', vehicleType: 'TATA_ACE', zoneCode: 'CENTRAL' });
  assert.equal(r.available, false);
  assert.equal(r.reason, 'VEHICLE_NOT_AVAILABLE');
});

test('pickup outside operating zone is rejected', () => {
  const r = canCreateBooking({
    city,
    serviceCode: 'PARCEL_2W',
    vehicleType: 'BIKE',
    pickup: { lat: 20.20, lng: 75.35 },
    drop: { lat: 19.87, lng: 75.33 },
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, 'PICKUP_OUTSIDE_SERVICE_AREA');
});

test('drop outside city is rejected when outstation is disabled', () => {
  const r = canCreateBooking({
    city,
    serviceCode: 'PARCEL_2W',
    vehicleType: 'BIKE',
    pickup: { lat: 19.87, lng: 75.33 },
    drop: { lat: 20.20, lng: 75.35 },
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, 'DROP_OUTSIDE_SERVICE_AREA');
});

test('valid in-zone booking is allowed and returns zone codes', () => {
  const r = canCreateBooking({
    city,
    serviceCode: 'PARCEL_2W',
    vehicleType: 'BIKE',
    pickup: { lat: 19.87, lng: 75.33 },
    drop: { lat: 19.88, lng: 75.34 },
  });
  assert.equal(r.allowed, true);
  assert.equal(r.pickupZoneCode, 'CENTRAL');
  assert.equal(r.dropZoneCode, 'CENTRAL');
});

test('city service summary separates active coming soon and paused services', () => {
  const s = cityServiceSummary(city);
  assert.deepEqual(s.active, ['PARCEL_2W']);
  assert.deepEqual(s.comingSoon, ['LOADING_VEHICLE']);
  assert.deepEqual(s.paused, ['HELPER']);
});
