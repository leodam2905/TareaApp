// The one place a labour amount is computed.
//
// The model changed shape: Tarea used to set the price from a rate card and a
// pro could take that price or leave it. Now the PRO sets their rate, Tarea AI
// estimates ONE billable time, and the amount is arithmetic both sides can
// check:
//
//   initialLaborAmount = (proRateSnapshot / 60) * estimatedBillableMinutes
//
// The rate card in ./pricing-config did not become wrong, it became a FALLBACK.
// It is still what an open job request is quoted at, because no pro has been
// chosen yet and there is no rate to use; and it still covers a pro who has not
// set a rate for the category. What it no longer does is override a pro who has.

import {
  grossHourlyFor,
  grossTravel,
  URGENCY_RATE,
} from "./pricing-config";
import { CUSTOMER_FEE_RATE } from "./fees";

/**
 * The shortest job a pro bills for, when they have not set their own.
 *
 * 60 minutes, and it is measured rather than picked: the retired $120 floor
 * minus $30 travel already bought 1.00h at the electrical/HVAC rate and 1.06h
 * at plumbing, so for the skilled trades this default reproduces what the
 * platform was already charging. Where it differs is the cheap end of the rate
 * card, where a flat dollar floor was quietly imposing a 1.8h minimum on
 * cleaning and 2.25h on laundry.
 */
export const DEFAULT_MINIMUM_MINUTES = 60;

/** A pro may bill a longer minimum, never a shorter one. */
export const MIN_MINIMUM_MINUTES = 60;
export const MAX_MINIMUM_MINUTES = 240;

/**
 * Absolute floor, in dollars. NOT a pricing policy — fraud protection.
 *
 * It exists so a crafted request cannot book a job for a cent. It is set far
 * below any real quote precisely so it never decides a price: the moment a
 * dollar floor starts binding, it is setting one price for every competing pro
 * and the pro's own rate stops mattering. That is what MINIMUM_NET_JOB did.
 */
export const ABSOLUTE_MINIMUM_CHARGE = 25;

export type RateSource = "pro_service" | "pro_profile" | "market_low" | "rate_card";

export type ResolvedRate = {
  /** Customer-facing hourly rate in dollars. */
  hourlyRate: number;
  source: RateSource;
};

/**
 * Whose rate prices this job.
 *
 * Most specific wins: the rate the pro set for THIS category, then their
 * profile rate, then the cheapest rate any eligible pro actually charges, then
 * the rate card. A pro who has never touched either is quoted at the card
 * rather than at zero — a $0 rate is not a cheap pro, it is a booking that
 * fails the minimum check and looks like the pro is broken.
 *
 * `marketRate` exists because the card was standing in far too often. On an
 * open request nobody has applied yet, so the card was used even when the real
 * rates were already known — and the customer was then quoted a number Tarea
 * invented while the job was filed at a real pro's. Measured on production:
 * a plumbing job showed $201.50 from the $85 card while the only eligible pro
 * charged $100/hr, making the true price $230. Understating an advertised
 * price by 14% is the concern SB 478 exists for, and the whole rate-card
 * fallback is what lib/rate-range.ts means by "nobody is quoted a number Tarea
 * invented".
 *
 * It is the LOW end deliberately. It matches the budget stored from
 * quoteRange().lowLabour, so the card the customer approves and the job filed
 * underneath it agree, and it matches the "labour (lowest)" row the app
 * already renders beside a range. The card now applies only where it was
 * always meant to: no pro serves this category at all.
 */
export function resolveRate(opts: {
  serviceHourlyRate?: number | null;
  profileHourlyRate?: number | null;
  /** Cheapest rate among pros who could actually take this job, if any. */
  marketRate?: number | null;
  category?: string | null;
}): ResolvedRate {
  const { serviceHourlyRate, profileHourlyRate, marketRate, category } = opts;
  if (serviceHourlyRate && serviceHourlyRate > 0) {
    return { hourlyRate: serviceHourlyRate, source: "pro_service" };
  }
  if (profileHourlyRate && profileHourlyRate > 0) {
    return { hourlyRate: profileHourlyRate, source: "pro_profile" };
  }
  if (marketRate && marketRate > 0) {
    return { hourlyRate: marketRate, source: "market_low" };
  }
  return { hourlyRate: grossHourlyFor(category), source: "rate_card" };
}

export type LaborQuote = {
  hourlyRate: number;
  /** Tarea AI's honest estimate of the work. */
  estimatedBillableMinutes: number;
  /** The pro's shortest billable job. */
  minimumMinutes: number;
  /** What is actually billed: the estimate, or the minimum if it is longer. */
  billableMinutes: number;
  /** rate x billableMinutes, before travel and urgency. */
  labor: number;
  travel: number;
  urgency: number;
  /** What the customer is quoted for labour. */
  initialLaborAmount: number;
  /** True when the pro's minimum, not the estimate, decided the time billed.
   *  Shown to the customer — a bill longer than the estimate needs its reason. */
  minimumApplied: boolean;
};

/**
 * Turns a rate and an estimated time into the amount a customer is quoted.
 *
 * Materials are deliberately absent. They are quoted by the pro when they
 * accept, carry no platform fee, and are reconciled against receipts at
 * completion — mixing them in here would put a fee on a reimbursement.
 */
export function quoteLabor(opts: {
  hourlyRate: number;
  estimatedBillableMinutes: number;
  urgent?: boolean;
  /** The pro's minimum billable time. Pass a booking's snapshot when re-deriving. */
  minimumMinutes?: number;
  /** Travel is included by default; extensions pass 0 (the pro is already there). */
  includeTravel?: boolean;
}): LaborQuote {
  const hourlyRate = Math.max(0, opts.hourlyRate);
  const estimatedBillableMinutes = Math.max(0, Math.round(opts.estimatedBillableMinutes));
  const minimumMinutes = resolveMinimumMinutes(opts.minimumMinutes);
  const includeTravel = opts.includeTravel !== false;

  // The minimum lengthens the TIME billed, it does not overwrite the price.
  // That is the whole difference: a short job still costs less from a cheaper
  // pro, because the rate is still doing the arithmetic.
  const billableMinutes = Math.max(estimatedBillableMinutes, minimumMinutes);

  const labor = (hourlyRate / 60) * billableMinutes;
  const urgency = opts.urgent ? labor * URGENCY_RATE : 0;
  const travel = includeTravel ? grossTravel() : 0;

  // Fraud protection only — see ABSOLUTE_MINIMUM_CHARGE. In any real quote this
  // is far below the arithmetic and never binds.
  const initialLaborAmount = round2(Math.max(labor + travel + urgency, ABSOLUTE_MINIMUM_CHARGE));

  return {
    hourlyRate,
    estimatedBillableMinutes,
    minimumMinutes,
    billableMinutes,
    labor: round2(labor),
    travel: round2(travel),
    urgency: round2(urgency),
    initialLaborAmount,
    minimumApplied: billableMinutes > estimatedBillableMinutes,
  };
}

/** Clamps a pro's chosen minimum into the allowed band, defaulting when unset. */
export function resolveMinimumMinutes(minutes?: number | null): number {
  if (minutes == null || !Number.isFinite(minutes)) return DEFAULT_MINIMUM_MINUTES;
  return Math.min(Math.max(Math.round(minutes), MIN_MINIMUM_MINUTES), MAX_MINIMUM_MINUTES);
}

/**
 * What extra time costs once the pro is already on site.
 *
 * No travel (they did not drive twice), no urgency (that priced getting there
 * fast, not staying longer) and NO minimum — the floor exists to make a call-out
 * worth making, and this call-out already happened. Applying it here would turn
 * fifteen extra minutes into another $133.
 */
export function quoteExtraTime(opts: {
  hourlyRate: number;
  additionalMinutes: number;
}): number {
  const rate = Math.max(0, opts.hourlyRate);
  const minutes = Math.max(0, Math.round(opts.additionalMinutes));
  return round2((rate / 60) * minutes);
}

/** Minutes as the customer reads them: "1h 30m", "45m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;


export type QuotedRange = {
  estimatedBillableMinutes: number;
  /** Cheapest eligible pro: their rate, and what the customer would pay in full. */
  lowRate: number;
  lowTotal: number;
  /** Dearest. Equal to the low pair when only one pro qualifies. */
  highRate: number;
  highTotal: number;
  /** The same two ends as LABOUR, before the customer fee.
   *
   *  Both are needed and they are not interchangeable. The totals are what a
   *  customer is shown, fee included, because SB 478 makes an advertised range
   *  a price. These are what a job request stores as its budget: budgetMax is
   *  multiplied by the fee again in the CSLB cap check, and budgetMin is the
   *  labour figure hireAmounts falls back to, so a fee-inclusive number in
   *  either place would be charged the fee twice. */
  lowLabour: number;
  highLabour: number;
  /** How many pros the interval is drawn from. */
  proCount: number;
  /** True when one pro qualifies, so there is a price rather than a range. */
  single: boolean;
};

/**
 * The interval a customer is quoted before they have chosen anyone.
 *
 * Both ends are TOTALS — labour plus the platform fee — not labour subtotals.
 * California's SB 478 requires an advertised price to include every mandatory
 * fee, and a range is still an advertised price: showing $142–$225 and then
 * charging $178–$281 at checkout is exactly the drip-pricing the statute names.
 *
 * Materials are excluded on purpose. They are quoted by the pro after they see
 * the job, are reimbursed at cost, and carry no fee — a number nobody can know
 * yet does not belong inside a price the customer is being asked to rely on.
 */
export function quoteRange(opts: {
  minRate: number;
  maxRate: number;
  proCount: number;
  estimatedBillableMinutes: number;
  urgent?: boolean;
  /** Pros may set different minimums; the range uses the default for both ends
   *  because it is quoted before any pro is chosen. */
  minimumMinutes?: number;
}): QuotedRange {
  const labourAt = (rate: number) =>
    round2(
      quoteLabor({
        hourlyRate: rate,
        estimatedBillableMinutes: opts.estimatedBillableMinutes,
        minimumMinutes: opts.minimumMinutes,
        urgent: opts.urgent,
      }).initialLaborAmount,
    );
  const total = (rate: number) => round2(labourAt(rate) * (1 + CUSTOMER_FEE_RATE));

  // Guard the ordering rather than trusting the caller: a swapped pair would
  // render as "$225 - $142", which reads as a bug to a customer and is one.
  const lowRate = Math.min(opts.minRate, opts.maxRate);
  const highRate = Math.max(opts.minRate, opts.maxRate);

  const lowTotal = total(lowRate);
  const highTotal = total(highRate);
  const lowLabour = labourAt(lowRate);
  const highLabour = labourAt(highRate);

  return {
    estimatedBillableMinutes: opts.estimatedBillableMinutes,
    lowRate,
    lowTotal,
    highRate,
    highTotal,
    lowLabour,
    highLabour,
    proCount: opts.proCount,
    // The floor can collapse two different rates onto the same total. Showing
    // "$150 - $150" is a range in name only, so it is reported as a single.
    single: opts.proCount <= 1 || lowTotal === highTotal,
  };
}