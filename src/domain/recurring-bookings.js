export function normalizeWeekdays(days = []) {
  const unique = [...new Set(days.map(Number))].filter(d => d >= 0 && d <= 6).sort((a,b)=>a-b);
  return unique;
}

export function validateRecurringPlan(plan) {
  const errors = [];
  if (!plan.customerId) errors.push('customer_required');
  if (!plan.serviceType) errors.push('service_required');
  if (!plan.pickup || !plan.drop) errors.push('route_required');
  if (!plan.startDate || !plan.endDate) errors.push('date_range_required');
  if (plan.startDate && plan.endDate && new Date(plan.endDate) < new Date(plan.startDate)) errors.push('invalid_date_range');
  if (!plan.pickupTime) errors.push('pickup_time_required');
  if (normalizeWeekdays(plan.weekdays).length === 0) errors.push('weekday_required');
  if (plan.returnEnabled && !plan.returnTime) errors.push('return_time_required');
  return { valid: errors.length === 0, errors };
}

export function occursOn(date, plan) {
  const d = new Date(date);
  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  if (d < start || d > end) return false;
  return normalizeWeekdays(plan.weekdays).includes(d.getDay());
}

export function generateOccurrences(plan, fromDate, toDate) {
  const check = validateRecurringPlan(plan);
  if (!check.valid) throw new Error(`invalid_recurring_plan:${check.errors.join(',')}`);
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const out = [];
  for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    if (!occursOn(cursor, plan)) continue;
    const date = cursor.toISOString().slice(0,10);
    out.push({ date, leg: 'OUTBOUND', scheduledTime: plan.pickupTime });
    if (plan.returnEnabled) out.push({ date, leg: 'RETURN', scheduledTime: plan.returnTime });
  }
  return out;
}

export function shouldSendReminder({ scheduledAt, now = new Date(), leadMinutes = 60 }) {
  const diff = new Date(scheduledAt).getTime() - new Date(now).getTime();
  return diff > 0 && diff <= leadMinutes * 60_000;
}

export function nextGenerationWindow(now = new Date(), horizonDays = 7) {
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + horizonDays);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function canReuseRoute({ existing, next }) {
  return existing.pickupLat === next.pickupLat && existing.pickupLng === next.pickupLng && existing.dropLat === next.dropLat && existing.dropLng === next.dropLng;
}

export function businessRepeatRouteLabel(route) {
  return route.name || `${route.pickupLabel || 'Pickup'} → ${route.dropLabel || 'Drop'}`;
}
