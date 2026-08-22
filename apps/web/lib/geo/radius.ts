// Service-radius validation and unit conversion.
//
// serviceRadius is a DISTRIBUTION CONTROL, not a display preference: it decides
// which pros a job is broadcast to. /api/profile previously accepted it through
// a bare parseInt() with no bounds, so a pro could set 99999 and receive every
// job in the country — the exact nationwide fan-out this work exists to prevent.
// It is therefore validated as untrusted input, and the value used for matching
// is always the stored one, never anything supplied in the matching request.

export const MIN_RADIUS_MILES = 1;

// No maximum existed anywhere in the codebase or database before this. 50 is the
// current default and matches the old matcher's constant; 100 gives room to set
// a wider area without allowing effectively-nationwide distribution.
// This is a product decision, not a technical constraint — see MAX_RADIUS_NOTE.
export const MAX_RADIUS_MILES = 100;

export const METERS_PER_MILE = 1609.344;

export type RadiusError = "not_a_number" | "not_finite" | "too_small" | "too_large";

export interface RadiusResult {
  ok: boolean;
  miles?: number;
  error?: RadiusError;
  message?: string;
}

const MESSAGES: Record<RadiusError, string> = {
  not_a_number: "Enter your service radius as a number of miles.",
  not_finite: "Enter your service radius as a number of miles.",
  too_small: `Your service radius must be at least ${MIN_RADIUS_MILES} mile.`,
  too_large: `Your service radius can be at most ${MAX_RADIUS_MILES} miles.`,
};

/**
 * Validate an untrusted service radius in miles.
 *
 * Rejects NaN, Infinity, non-numeric strings, zero, negatives and anything
 * beyond the cap. Fractions are floored: the column is an integer, and
 * parseInt() previously truncated silently.
 */
export function validateRadiusMiles(input: unknown): RadiusResult {
  let n: number;

  if (typeof input === "number") {
    n = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    // Number() rather than parseInt(): parseInt("50abc") returns 50, quietly
    // accepting malformed input.
    if (trimmed === "") return { ok: false, error: "not_a_number", message: MESSAGES.not_a_number };
    n = Number(trimmed);
  } else {
    return { ok: false, error: "not_a_number", message: MESSAGES.not_a_number };
  }

  if (Number.isNaN(n)) return { ok: false, error: "not_a_number", message: MESSAGES.not_a_number };
  if (!Number.isFinite(n)) return { ok: false, error: "not_finite", message: MESSAGES.not_finite };

  const floored = Math.floor(n);
  if (floored < MIN_RADIUS_MILES) return { ok: false, error: "too_small", message: MESSAGES.too_small };
  if (floored > MAX_RADIUS_MILES) return { ok: false, error: "too_large", message: MESSAGES.too_large };

  return { ok: true, miles: floored };
}

/**
 * Convert a validated radius to meters for ST_DWithin, which works in meters on
 * `geography`. Throws rather than coercing: an invalid radius reaching the query
 * would widen distribution, so it must fail loudly.
 */
export function radiusMilesToMeters(miles: number): number {
  const check = validateRadiusMiles(miles);
  if (!check.ok || check.miles === undefined) {
    throw new Error(`Invalid service radius for matching: ${String(miles)} (${check.error})`);
  }
  return check.miles * METERS_PER_MILE;
}

// ---------------------------------------------------------------------------
// Distance bands
// ---------------------------------------------------------------------------
// Pros see a band, never a distance, a rounded point or coordinates. An exact
// distance from a known pro location trilaterates the customer's address across
// a few job views, and a rounded point is still a point. The band is computed in
// the protected query and only the label leaves the server.

export const DISTANCE_BANDS = [
  { maxMiles: 2, label: "Under 2 miles" },
  { maxMiles: 5, label: "2–5 miles" },
  { maxMiles: 10, label: "5–10 miles" },
  { maxMiles: 25, label: "10–25 miles" },
  { maxMiles: 50, label: "25–50 miles" },
  { maxMiles: Infinity, label: "Over 50 miles" },
] as const;

export type DistanceBandLabel = (typeof DISTANCE_BANDS)[number]["label"];

/** Map a server-computed distance in meters to a coarse band label. */
export function distanceBand(meters: number): DistanceBandLabel {
  if (!Number.isFinite(meters) || meters < 0) {
    // Unknown distance must never read as "very close".
    return "Over 50 miles";
  }
  const miles = meters / METERS_PER_MILE;
  for (const band of DISTANCE_BANDS) {
    if (miles < band.maxMiles) return band.label;
  }
  return "Over 50 miles";
}

// MAX_RADIUS_NOTE
// ---------------
// MAX_RADIUS_MILES = 100 is a placeholder pending a product decision. No maximum
// existed before, so any value here is new policy. Raising it widens who gets
// notified; lowering it may cut off rural pros who genuinely travel further.
