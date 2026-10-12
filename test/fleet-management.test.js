import test from 'node:test';
import assert from 'node:assert/strict';
import { assignDriverToVehicle, fleetDashboardSummary, vehicleUtilization, driverPerformance } from '../src/domain/fleet-management.js';

test('assigns an available driver to an available vehicle', () => {
  const result = assignDriverToVehicle({ vehicleId: 'v1', driverId: 'd1', activeAssignments: [] });
  assert.equal(result.vehicleId, 'v1');
  assert.equal(result.driverId, 'd1');
  assert.equal(result.status, 'active');
});

test('prevents duplicate active vehicle or driver assignment', () => {
  assert.throws(() => assignDriverToVehicle({
    vehicleId: 'v1', driverId: 'd2', activeAssignments: [{ vehicleId: 'v1', driverId: 'd1', status: 'active' }]
  }));
  assert.throws(() => assignDriverToVehicle({
    vehicleId: 'v2', driverId: 'd1', activeAssignments: [{ vehicleId: 'v1', driverId: 'd1', status: 'active' }]
  }));
});

test('fleet dashboard summarizes vehicles drivers trips and earnings', () => {
  const summary = fleetDashboardSummary({
    vehicles: [{status:'active'}, {status:'maintenance'}],
    drivers: [{online:true}, {online:false}],
    bookings: [
      {status:'completed', customerFare:1000, partnerEarning:850},
      {status:'completed', customerFare:500, partnerEarning:425},
      {status:'cancelled', customerFare:200, partnerEarning:0},
    ],
    ledger: [{type:'payout', amount:1000}, {type:'credit', amount:200}],
  });
  assert.equal(summary.totalVehicles, 2);
  assert.equal(summary.activeVehicles, 1);
  assert.equal(summary.onlineDrivers, 1);
  assert.equal(summary.completedTrips, 2);
  assert.equal(summary.grossRevenue, 1500);
  assert.equal(summary.partnerEarnings, 1275);
  assert.equal(summary.payouts, 1000);
});

test('vehicle utilization and driver performance are calculated', () => {
  const bookings = [
    {vehicleId:'v1', driverId:'d1', status:'completed', completedAt:'2026-10-01T10:00:00Z', rating:5, onTime:true, partnerEarning:500},
    {vehicleId:'v1', driverId:'d1', status:'completed', completedAt:'2026-10-02T10:00:00Z', rating:4, onTime:false, partnerEarning:700},
  ];
  const utilization = vehicleUtilization({ vehicleId:'v1', bookings, periodDays:10 });
  assert.equal(utilization.completedTrips, 2);
  assert.equal(utilization.activeDays, 2);
  assert.equal(utilization.utilizationPct, 20);

  const performance = driverPerformance({ driverId:'d1', bookings });
  assert.equal(performance.trips, 2);
  assert.equal(performance.averageRating, 4.5);
  assert.equal(performance.onTimeRate, 50);
  assert.equal(performance.earnings, 1200);
});
