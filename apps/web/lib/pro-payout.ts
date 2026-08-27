import { createHash } from "crypto";
// What a pro is owed for a completed booking. ONE DEFINITION.
//
// This was computed independently at five call sites and they did not agree.
// Only completeBooking() included materials; the weekly-payout cron, the admin
// manual payout and instant cashout all paid labour net alone. So a pro paid
// through any path except the happy one silently lost their materials money.
//
// That is not a rounding difference. Materials are cash the pro already spent
// on the customer's job, and the customer was charged for it as its own line
// item — "Cost of materials required to complete the job. Handyman will provide
// receipts." Dropping it from the payout means Tarea keeps it.
//
// The fee applies to LABOUR ONLY. Materials pass through at cost: taking 10% of
// a receipt the pro is being reimbursed for would make them lose money by
// buying supplies.

import { handymanNet } from "./fees";

export interface PayableBooking {
  totalPrice: number;
  materialsEstimate?: number | null;
  /** What the receipt said, when the pro gave a figure. */
  materialsActual?: number | null;
}

/**
 * Materials the pro is reimbursed for: at cost, CAPPED AT THE ESTIMATE.
 *
 * Spend less than quoted and only the real spend is reimbursed — the rest goes
 * back to the customer, who should not pay for materials nobody bought. Spend
 * MORE and the estimate is the ceiling: the pro chose that number, the customer
 * agreed to it before the job, and only the pro can control the overrun.
 *
 * No figure given means the estimate stands — there is nothing to reconcile
 * against, and withholding a pro's money on an absence would be worse.
 */
export function materialsOwed(b: PayableBooking): number {
  const estimate = b.materialsEstimate ?? 0;
  if (b.materialsActual === null || b.materialsActual === undefined) return estimate;
  return Math.min(Math.max(0, b.materialsActual), estimate);
}

/** What goes back to the customer: the part of the estimate nobody spent. */
export function materialsRefundDue(b: PayableBooking): number {
  return Math.round(((b.materialsEstimate ?? 0) - materialsOwed(b)) * 100) / 100;
}

/** Labour net of the platform fee, plus materials reimbursed at cost. */
export function proOwedFor(b: PayableBooking): number {
  return handymanNet(b.totalPrice) + materialsOwed(b);
}

/** Total owed across several bookings, rounded to cents once at the end. */
export function proOwedForAll(bookings: PayableBooking[]): number {
  return Math.round(bookings.reduce((s, b) => s + proOwedFor(b), 0) * 100) / 100;
}

/**
 * A stable Stripe idempotency key for paying out a specific set of bookings.
 *
 * The durable guard against double-paying is booking.handymanPaidOut, but there
 * is a window between the transfer landing and that flag being written: if the
 * process dies, or a later step in the same handler throws, the money has moved
 * and nothing recorded it. A retry then transfers a second time.
 *
 * Keying on the booking ids closes that window from Stripe's side — the same
 * set of jobs cannot be transferred twice, whichever path asks (weekly cron,
 * instant cashout, or completion), because Stripe returns the original transfer
 * instead of creating another. Stripe retains these keys for 24 hours, which
 * covers the retry window; the database flag covers everything after it.
 */
export function payoutIdempotencyKey(bookingIds: string[], purpose: string): string {
  const digest = createHash("sha256").update([...bookingIds].sort().join(",")).digest("hex");
  return `tarea-${purpose}-${digest.slice(0, 32)}`;
}
