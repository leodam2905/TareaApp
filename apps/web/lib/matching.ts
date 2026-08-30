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
  /** Licence approved by an admin and unexpired — see lib/credentials.ts. */
  licensed?: boolean;
  /** Insurance certificate approved and unexpired. */
  insured?: boolean;
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


/**
 * Credentials sort ABOVE the score, not inside it.
 *
 * A boost, however large, is still a number another pro can out-accumulate:
 * enough five-star reviews and an uninsured pro climbs back to the top. That is
 * the wrong shape for this particular signal, because the risk it carries does
 * not shrink as the ratings improve — an uninsured pro damaging a kitchen is
 * the customer's problem no matter how well reviewed they are.
 *
 * So it is a tier. Licensed AND insured outranks one credential, which outranks
 * none, and quality decides the order WITHIN each tier.
 *
 * The cost of this is real and worth stating: in categories where no licence is
 * legally required — cleaning, moving, furniture assembly — an excellent
 * uncredentialed pro is pushed below a mediocre credentialed one for a
 * distinction the job does not turn on.
 */
/**
 * @param licenseRelevant whether a licence is a real distinction for the work
 *   in question — see licenseMatters() in lib/credentials. Insurance always
 *   counts: a pro can damage a floor whether or not their trade is regulated.
 *   A licence only counts where the law asks for one, otherwise an excellent
 *   cleaner is sorted below a mediocre one over a document neither job needed.
 */
export const credentialTier = (h: Rankable, licenseRelevant = true): number =>
  (h.insured ? 1 : 0) + (licenseRelevant && h.licensed ? 1 : 0);

/** Sort comparator: credentials first, then fit. Highest first. */
export function compareForCustomer(a: Rankable, b: Rankable, licenseRelevant = true): number {
  const tier = credentialTier(b, licenseRelevant) - credentialTier(a, licenseRelevant);
  if (tier !== 0) return tier;
  return matchScore(b) - matchScore(a);
}

export type MatchBand = "excellent" | "great" | "good" | "fair";

/**
 * Why this pro is being shown, in terms a customer can act on.
 *
 * Codes, not sentences: the apps localise into four languages, so a server that
 * returned English prose would be untranslatable. Deliberately no percentage —
 * the raw score tops out at 105 and a realistic new pro already scores ~60, so
 * "57% match" would read as a warning about somebody perfectly good.
 */
export type MatchReason =
  | "licensed_insured"
  | "licensed"
  | "insured"
  | "highly_rated"
  | "experienced"
  | "fast_replies"
  | "nearby"
  | "new_pro";

export interface MatchQuality {
  score: number;
  band: MatchBand;
  reasons: MatchReason[];
  licensed: boolean;
  insured: boolean;
}

export function matchQuality(h: Rankable): MatchQuality {
  const score = matchScore(h);
  const licensed = !!h.licensed;
  const insured = !!h.insured;

  const band: MatchBand =
    score >= 85 ? "excellent" : score >= 72 ? "great" : score >= 60 ? "good" : "fair";

  const reasons: MatchReason[] = [];
  // Credentials lead, because they are why this pro is placed where they are.
  if (licensed && insured) reasons.push("licensed_insured");
  else if (licensed) reasons.push("licensed");
  else if (insured) reasons.push("insured");

  if (ratingScore(h.rating, h.totalJobs) >= 45) reasons.push("highly_rated");
  if (h.totalJobs >= 25) reasons.push("experienced");
  if (h.responseTime <= 30) reasons.push("fast_replies");
  if (h.distanceKm != null && h.distanceKm <= 10) reasons.push("nearby");
  // Said plainly rather than hidden. A new pro has no record, and a customer
  // who chooses one should know that rather than infer it from a thin badge row.
  if (h.totalJobs === 0) reasons.push("new_pro");

  return { score, band, reasons, licensed, insured };
}