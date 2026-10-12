export function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function computePartnerQualityScore(metrics) {
  const {
    averageRating = 0,
    completedTrips = 0,
    onTimeRate = 0,
    postAcceptCancellationRate = 0,
    damageFreeRate = 100,
    complaintRate = 0,
    repeatCustomerRate = 0,
    recentPerformance = 50,
  } = metrics;

  const ratingScore = clamp((averageRating / 5) * 100);
  const experienceScore = clamp(Math.log10(Math.max(1, completedTrips)) / 3 * 100);
  const cancellationScore = clamp(100 - postAcceptCancellationRate * 5);
  const complaintScore = clamp(100 - complaintRate * 8);

  const score =
    ratingScore * 0.22 +
    clamp(onTimeRate) * 0.20 +
    cancellationScore * 0.16 +
    clamp(damageFreeRate) * 0.14 +
    complaintScore * 0.10 +
    clamp(repeatCustomerRate) * 0.07 +
    clamp(recentPerformance) * 0.07 +
    experienceScore * 0.04;

  return Math.round(clamp(score));
}

export function bookingPriority(score) {
  if (score >= 90) return 'HIGH';
  if (score >= 75) return 'NORMAL';
  if (score >= 60) return 'LOW';
  return 'RESTRICTED';
}

export function summarizeReviews(reviews = []) {
  const tags = {
    punctual: ['on time', 'punctual', 'time'],
    polite: ['polite', 'helpful', 'good behaviour', 'behavior'],
    vehicleClean: ['clean', 'neat'],
    safeHandling: ['safe', 'careful', 'no damage'],
    late: ['late', 'delay'],
    rude: ['rude', 'bad behaviour', 'bad behavior'],
    damage: ['damage', 'broken', 'scratch'],
  };

  const counts = Object.fromEntries(Object.keys(tags).map(k => [k, 0]));
  for (const r of reviews) {
    const text = String(r.comment || '').toLowerCase();
    for (const [tag, words] of Object.entries(tags)) {
      if (words.some(w => text.includes(w))) counts[tag] += 1;
    }
  }

  const positives = [
    ['punctual', 'Punctual pickup/delivery'],
    ['polite', 'Polite & helpful'],
    ['vehicleClean', 'Clean vehicle'],
    ['safeHandling', 'Safe goods handling'],
  ].filter(([k]) => counts[k] > 0).sort((a,b)=>counts[b[0]]-counts[a[0]]).slice(0,3).map(([,label])=>label);

  const concerns = [
    ['late', 'Occasional delay'],
    ['rude', 'Behaviour concern'],
    ['damage', 'Goods-handling concern'],
  ].filter(([k]) => counts[k] > 0).sort((a,b)=>counts[b[0]]-counts[a[0]]).slice(0,2).map(([,label])=>label);

  return {
    positives,
    concerns,
    headline: concerns.length === 0 ? 'Customers are generally satisfied' : 'Good overall, with a few recent concerns',
  };
}

export function aiMatchLabel({ qualityScore, etaMinutes, priceDeltaPct = 0 }) {
  if (qualityScore >= 90 && etaMinutes <= 15) return 'AI Best Match';
  if (priceDeltaPct <= -8) return 'Best Value';
  if (etaMinutes <= 8) return 'Fastest Arrival';
  return 'Recommended';
}
