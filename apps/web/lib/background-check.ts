// The background-check fee, and the single rule for recouping it.
//
// A pro may defer the $29.99 rather than pay up front, on the promise that it
// comes out of their first payout. That promise was only kept on ONE of the two
// payout paths: the deduction existed in /api/handyman/cashout (instant) and
// nowhere else. The weekly cron transferred proOwedForAll() untouched, so a pro
// who deferred and took ordinary weekly payouts was never charged, and their
// status sat at DEFERRED for ever — the fee was uncollectable and the screening
// never moved on. Both paths now share this definition so they cannot drift
// apart again.

export const BACKGROUND_CHECK_FEE = 29.99; // USD

export interface BgCheckDeduction {
  /** Dollars to withhold from this payout. Zero means take nothing. */
  amount: number;
  /** True when the fee is owed but this payout is too small to carry it. */
  deferredAgain: boolean;
}

/**
 * How much of a payout is owed to the background-check fee.
 *
 * Only charged when the payout can cover it AND still leave something worth
 * sending. A payout smaller than that is paid in full and the charge waits for
 * the next one, rather than zeroing out a pro's earnings or taking a
 * part-payment — partial recovery would need somewhere to record the
 * remainder, and there is no such column.
 *
 * `minRemainder` is what must survive the deduction. Deducting down to a cent
 * is not free: Stripe rejects payouts below its minimum, so $30.00 of earnings
 * minus $29.99 is not a 1c payout, it is a failed one — and on the instant path
 * the 1% fee comes off too, which can drive the amount negative outright.
 *
 * The caller marks the check paid afterwards, which is what stops it being
 * taken twice.
 */
export function bgCheckDeductionFor(
  status: string | null | undefined,
  gross: number,
  minRemainder = 1,
): BgCheckDeduction {
  if (status !== "DEFERRED") return { amount: 0, deferredAgain: false };
  if (gross - BACKGROUND_CHECK_FEE < minRemainder) {
    return { amount: 0, deferredAgain: true };
  }
  return { amount: BACKGROUND_CHECK_FEE, deferredAgain: false };
}
