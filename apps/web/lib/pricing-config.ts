// Numbers that decide what a pro earns.
//
// These were constants scattered through a route file, or values an LLM chose
// per request. Both are wrong for the same reason: the price is fixed and a pro
// cannot refuse to honour it, so whoever sets these is setting somebody's wage.
// That should be a deliberate, visible decision in one place.

import { HANDYMAN_FEE_RATE } from "./fees";

/**
 * What a pro should NET per hour, before the platform's cut.
 *
 * Calibrated to LOS ANGELES, the launch market — not a US average. LA general
 * handyman work runs $75–150/hr in 2026 (typically $85–125), and licensed
 * plumbing or electrical $100–175. An earlier version of this table used
 * national figures and sat 30–50% under those, which is the level at which pros
 * simply do not accept jobs.
 *
 * Compare TaskRabbit, where a tasker keeps 100% of the rate they set. Tarea
 * takes 10% from the pro, so quoting "market rate" leaves them 10% below it —
 * these are NET targets and grossUp() is what the customer is quoted.
 *
 * Revisit per market before launching outside LA.
 */
export const TARGET_NET_HOURLY: Record<string, number> = {
  ELECTRICAL: 90,
  HVAC: 90,
  PLUMBING: 85,
  ROOFING: 85,
  GENERAL: 78,
  APPLIANCE_REPAIR: 78,
  CARPENTRY: 75,
  PAINTING: 70,
  LANDSCAPING: 60,
  MOVING: 60,
  CLEANING: 50,
  LAUNDRY: 40,
};

export const DEFAULT_NET_HOURLY = 78;

/**
 * What a pro should NET for the trip.
 *
 * Was a flat $15 gross — about $13.50 after the fee, roughly ten minutes of an
 * LA pro's time. Twenty miles across Los Angeles is an hour in traffic, so a
 * realistic round trip inside a sane radius is thirty to sixty minutes. Distance is deliberately NOT priced here: the price
 * is fixed before a pro is chosen, so how far *they* drive is unknowable at
 * quote time. It is bounded instead by each pro's own serviceRadius.
 */
export const TARGET_NET_TRAVEL = 30;

/** Uplift applied to an urgent job's labour. */
export const URGENCY_RATE = 0.2;

/**
 * The floor under any job.
 *
 * A price too low to be worth the trip is not a cheap job — it is a job nobody
 * accepts, which looks exactly like having no pros. Below this, a call-out is
 * not worth making.
 */
export const MINIMUM_NET_JOB = 120;

/**
 * Grosses a net target up so the pro receives it after the platform's cut.
 *
 * Materials are exempt from the fee and pass through at cost. Travel is the
 * same kind of thing — a cost the pro incurs, not labour they sell — but the
 * booking has no column to hold it separately, so exempting it structurally
 * would need a schema change. Grossing up reaches the same net without one.
 */
export const grossUp = (net: number) => net / (1 - HANDYMAN_FEE_RATE);

export const netHourlyFor = (category?: string | null) =>
  (category && TARGET_NET_HOURLY[category]) || DEFAULT_NET_HOURLY;

/** Customer-facing labour rate for a category, after gross-up. */
export const grossHourlyFor = (category?: string | null) =>
  grossUp(netHourlyFor(category));

/** Customer-facing travel allowance, after gross-up. */
export const grossTravel = () => grossUp(TARGET_NET_TRAVEL);

/** Customer-facing minimum, after gross-up. */
export const grossMinimum = () => grossUp(MINIMUM_NET_JOB);
