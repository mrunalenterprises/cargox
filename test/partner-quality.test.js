import test from 'node:test';
import assert from 'node:assert/strict';
import { computePartnerQualityScore, bookingPriority, summarizeReviews, aiMatchLabel } from '../src/domain/partner-quality.js';

test('high-performing partner receives high score and priority', () => {
  const score = computePartnerQualityScore({
    averageRating: 4.9, completedTrips: 1200, onTimeRate: 97,
    postAcceptCancellationRate: 1, damageFreeRate: 99.5,
    complaintRate: 0.5, repeatCustomerRate: 35, recentPerformance: 96,
  });
  assert.ok(score >= 90);
  assert.equal(bookingPriority(score), 'HIGH');
});

test('cancellation and complaints reduce score', () => {
  const good = computePartnerQualityScore({ averageRating: 4.7, completedTrips: 400, onTimeRate: 95, postAcceptCancellationRate: 1, damageFreeRate: 99, complaintRate: 1, recentPerformance: 90 });
  const bad = computePartnerQualityScore({ averageRating: 4.7, completedTrips: 400, onTimeRate: 80, postAcceptCancellationRate: 12, damageFreeRate: 94, complaintRate: 8, recentPerformance: 60 });
  assert.ok(good > bad);
});

test('review summary extracts positives and concerns', () => {
  const s = summarizeReviews([
    {comment:'Very punctual and polite driver, clean vehicle'},
    {comment:'Goods delivered safe with no damage'},
    {comment:'A little late today'}
  ]);
  assert.ok(s.positives.includes('Punctual pickup/delivery'));
  assert.ok(s.concerns.includes('Occasional delay'));
});

test('AI labels best match, value and fastest', () => {
  assert.equal(aiMatchLabel({qualityScore:94, etaMinutes:10}), 'AI Best Match');
  assert.equal(aiMatchLabel({qualityScore:80, etaMinutes:20, priceDeltaPct:-10}), 'Best Value');
  assert.equal(aiMatchLabel({qualityScore:80, etaMinutes:5}), 'Fastest Arrival');
});
