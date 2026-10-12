export function assignDriverToVehicle({ vehicleId, driverId, activeAssignments = [] }) {
  if (!vehicleId || !driverId) throw new Error('vehicleId and driverId are required');
  const vehicleBusy = activeAssignments.some(a => a.vehicleId === vehicleId && a.status === 'active');
  if (vehicleBusy) throw new Error('vehicle already has an active driver assignment');
  const driverBusy = activeAssignments.some(a => a.driverId === driverId && a.status === 'active');
  if (driverBusy) throw new Error('driver already has an active vehicle assignment');
  return { vehicleId, driverId, status: 'active', assignedAt: new Date().toISOString() };
}

export function fleetDashboardSummary({ vehicles = [], drivers = [], bookings = [], ledger = [] }) {
  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const onlineDrivers = drivers.filter(d => d.online === true).length;
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const grossRevenue = completedBookings.reduce((sum, b) => sum + Number(b.customerFare || 0), 0);
  const partnerEarnings = completedBookings.reduce((sum, b) => sum + Number(b.partnerEarning || 0), 0);
  const payouts = ledger.filter(x => x.type === 'payout').reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return {
    totalVehicles: vehicles.length,
    activeVehicles,
    totalDrivers: drivers.length,
    onlineDrivers,
    completedTrips: completedBookings.length,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    partnerEarnings: Math.round(partnerEarnings * 100) / 100,
    payouts: Math.round(payouts * 100) / 100,
  };
}

export function vehicleUtilization({ vehicleId, bookings = [], periodDays = 30 }) {
  const completed = bookings.filter(b => b.vehicleId === vehicleId && b.status === 'completed');
  const activeDays = new Set(completed.map(b => String(b.completedAt || b.createdAt || '').slice(0, 10)).filter(Boolean)).size;
  const utilizationPct = periodDays <= 0 ? 0 : Math.min(100, Math.round((activeDays / periodDays) * 100));
  return { vehicleId, completedTrips: completed.length, activeDays, periodDays, utilizationPct };
}

export function driverPerformance({ driverId, bookings = [] }) {
  const rows = bookings.filter(b => b.driverId === driverId && b.status === 'completed');
  if (!rows.length) return { driverId, trips: 0, averageRating: 0, onTimeRate: 0, earnings: 0 };
  const ratings = rows.map(r => Number(r.rating || 0)).filter(n => n > 0);
  const averageRating = ratings.length ? ratings.reduce((a,b) => a+b, 0) / ratings.length : 0;
  const onTimeCount = rows.filter(r => r.onTime === true).length;
  const earnings = rows.reduce((sum, r) => sum + Number(r.partnerEarning || 0), 0);
  return {
    driverId,
    trips: rows.length,
    averageRating: Math.round(averageRating * 100) / 100,
    onTimeRate: Math.round((onTimeCount / rows.length) * 100),
    earnings: Math.round(earnings * 100) / 100,
  };
}
