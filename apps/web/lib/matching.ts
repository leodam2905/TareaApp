// How pros are ranked for a customer.
//
// Modelled on how TaskRabbit matches: show the people who can actually do the
// job when the customer wants it, best fit first, and let the customer pick
// one directly. Not a bidding board — the customer should not have to run a
// procurement exercise to get a faucet fixed.
//
// The previous scorer sorted by raw distance first and only broke ties on
// quality, so a 3-star pro two miles away outranked a 4.9-star pro six miles
// away. It also gave isPremium 25 points against a 40-point rating ceiling,
// which let paid placement outweigh most of the quality signal. Both are fixed
// below.

export interface Rankable {
  rating: number;
  totalJobs: number;
  /** Minutes; lower is better. */
  responseTime: number;
  isPremium: boolean;
  distanceKm: number | null;
}

/** Weight of the prior, in "pretend reviews". */
const RATING_PRIOR_WEIGHT = 5;
const RATING_PRIOR_VALUE = 4.2;

/**
 * Bayesian-smoothed rating, 0-50.
 *
 * A single 5-star review is not evidence of a better pro than forty reviews
 * averaging 4.8, but a raw mean says it is — and a brand-new pro with no
 * reviews would otherwise score zero and never be seen, which is how a
 * marketplace fails to onboard supply. Both get pulled toward a prior.
 */
export function ratingScore(rating: number, totalJobs: number): number {
  const n = Math.max(0, totalJobs);
  const smoothed =
    (RATING_PRIOR_VALUE * RATING_PRIOR_WEIGHT + rating * n) / (RATING_PRIOR_WEIGHT + n);
  return (smoothed / 5) * 50;
}

/** Completed work, 0-20, flattening after 50 jobs so veterans cannot run away with it. */
export const experienceScore = (totalJobs: number) =>
  (Math.min(Math.max(0, totalJobs), 50) / 50) * 20;

/** Responsiveness, 0-10. Under 15 minutes is full marks; 4 hours or worse is none. */
export const responseScore = (minutes: number) => {
  const m = Math.max(0, minutes);
  if (m <= 15) return 10;
  if (m >= 240) return 0;
  return 10 * (1 - (m - 15) / (240 - 15));
};

/**
 * Proximity, 0-20, decaying with distance rather than dominating the order.
 *
 * Distance matters — it is travel time somebody is not paid for — but it is
 * one input, not the sort key. Unknown distance scores mid rather than last,
 * because "we could not measure it" is not the same as "far away".
 */
export const proximityScore = (distanceKm: number | null) => {
  if (distanceKm == null) return 10;
  if (distanceKm <= 5) return 20;
  if (distanceKm >= 100) return 0;
  return 20 * (1 - (distanceKm - 5) / 95);
};

/** Paid placement. Deliberately small: it must never outrank being good. */
const PREMIUM_BOOST = 5;

export function matchScore(h: Rankable): number {
  return (
    ratingScore(h.rating, h.totalJobs) +
    experienceScore(h.totalJobs) +
    responseScore(h.responseTime) +
    proximityScore(h.distanceKm) +
    (h.isPremium ? PREMIUM_BOOST : 0)
  );
}

/**
 * Whether a pro's weekly availability covers a requested moment.
 *
 * Availability is stored per weekday as an hour range. No rows at all means
 * "has not told us", which is treated as available — refusing to show a pro
 * because they skipped an onboarding step helps nobody.
 */
export function isAvailableAt(
  slots: { dayOfWeek: number; startHour: number; endHour: number }[],
  when: Date,
): boolean {
  if (!slots.length) return true;
  const day = when.getDay();
  const hour = when.getHours();
  return slots.some((s) => s.dayOfWeek === day && hour >= s.startHour && hour < s.endHour);
}
