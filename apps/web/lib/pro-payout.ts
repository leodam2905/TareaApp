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
}

/** Labour net of the platform fee, plus materials reimbursed at cost. */
export function proOwedFor(b: PayableBooking): number {
  return handymanNet(b.totalPrice) + (b.materialsEstimate ?? 0);
}

/** Total owed across several bookings, rounded to cents once at the end. */
export function proOwedForAll(bookings: PayableBooking[]): number {
  return Math.round(bookings.reduce((s, b) => s + proOwedFor(b), 0) * 100) / 100;
}
