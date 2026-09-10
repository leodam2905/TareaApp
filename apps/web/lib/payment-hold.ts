import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { DESCRIPTOR } from "@/lib/statement-descriptor";

// Uber-style payment: save the card when the customer books, place an
// authorization hold when a Pro accepts, capture at completion.
//
// Two Stripe constraints shape this:
//  1. Holds lapse after ~7 days. A booking scheduled further out must be
//     authorized closer to the job, not at acceptance (see needsDeferredAuth).
//  2. You cannot capture more than you authorized. Overcapture requires IC+
//     pricing, caps at +15% for our merchant category, and is unavailable on
//     Mastercard outside US restaurants — so add-ons are charged separately
//     rather than folded into the capture.

/** Stripe holds an online card authorization for ~7 days. */
const AUTH_VALID_DAYS = 7;
/** Authorize this far ahead of the job for bookings too distant to hold now. */
const AUTH_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

/** What the customer owes: labor + fee on labor + materials at cost. */
export function bookingTotal(totalPrice: number, materialsEstimate = 0): number {
  return Math.round((totalPrice * (1 + CUSTOMER_FEE_RATE) + materialsEstimate) * 100) / 100;
}

const toCents = (amount: number) => Math.round(amount * 100);

/** A hold placed now would lapse before this job runs. */
export function needsDeferredAuth(scheduledAt: Date): boolean {
  return scheduledAt.getTime() - Date.now() > (AUTH_VALID_DAYS - 1) * 24 * 60 * 60 * 1000;
}

/** True once it is close enough to the job to place the hold. */
export function readyForDeferredAuth(scheduledAt: Date): boolean {
  return scheduledAt.getTime() - Date.now() <= AUTH_LEAD_TIME_MS;
}

/** Ensure the user has a Stripe Customer we can attach saved cards to. */
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { tareaUserId: userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/**
 * Place the authorization hold for a booking. Idempotent: a booking that
 * already holds funds is returned untouched.
 *
 * Returns a reason string instead of throwing when the hold cannot be placed,
 * so callers can decide whether that is fatal (acceptance) or expected (cron).
 */
export async function authorizeBooking(
  bookingId: string
): Promise<{ ok: true; paymentIntentId: string } | { ok: false; reason: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { id: true, stripeCustomerId: true, defaultPaymentMethodId: true } } },
  });
  if (!booking) return { ok: false, reason: "Booking not found" };
  if (booking.isPaid || booking.capturedAt) return { ok: false, reason: "Already captured" };
  if (booking.authorizedAt && booking.stripePaymentIntentId) {
    return { ok: true, paymentIntentId: booking.stripePaymentIntentId };
  }

  const { stripeCustomerId, defaultPaymentMethodId } = booking.customer;
  if (!stripeCustomerId || !defaultPaymentMethodId) {
    return { ok: false, reason: "No saved payment method" };
  }

  const amount = bookingTotal(booking.totalPrice, booking.materialsEstimate ?? 0);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: toCents(amount),
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: defaultPaymentMethodId,
      // Hold the funds now, move them at completion.
      capture_method: "manual",
      // The customer is not in the app when a Pro accepts, so this is
      // merchant-initiated against a card they already authorized us to use.
      off_session: true,
      confirm: true,
      description: `Tarea booking ${booking.id}`,
      metadata: { bookingId: booking.id, kind: "booking_hold" },
      statement_descriptor_suffix: DESCRIPTOR.hold,
    });

    if (intent.status !== "requires_capture") {
      return { ok: false, reason: `Authorization not held (${intent.status})` };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        stripePaymentIntentId: intent.id,
        authorizedAmount: amount,
        authorizedAt: new Date(),
        authExpiresAt: new Date(Date.now() + AUTH_VALID_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    // A declined off-session charge lands here (card expired, insufficient
    // funds, issuer wants the cardholder present).
    const message = err instanceof Error ? err.message : "Card authorization failed";
    console.error("[authorizeBooking]", bookingId, message);
    return { ok: false, reason: message };
  }
}

/**
 * Capture the hold at completion. Captures the final amount, which may be
 * LOWER than authorized (job came in cheaper) but never higher — add-ons are
 * charged separately via chargeAddOn.
 */
export async function captureBooking(
  bookingId: string,
  finalAmount?: number
): Promise<{ ok: true; captured: number } | { ok: false; reason: string }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, reason: "Booking not found" };
  if (booking.capturedAt) return { ok: true, captured: booking.capturedAmount ?? 0 };
  if (!booking.stripePaymentIntentId || !booking.authorizedAt) {
    return { ok: false, reason: "No authorization to capture" };
  }

  const authorized = booking.authorizedAmount ?? bookingTotal(booking.totalPrice, booking.materialsEstimate ?? 0);
  const target = Math.min(finalAmount ?? authorized, authorized);

  try {
    await stripe.paymentIntents.capture(booking.stripePaymentIntentId, {
      amount_to_capture: toCents(target),
    });
    await prisma.booking.update({
      where: { id: bookingId },
      data: { capturedAmount: target, capturedAt: new Date(), isPaid: true },
    });
    return { ok: true, captured: target };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Capture failed";
    console.error("[captureBooking]", bookingId, message);
    return { ok: false, reason: message };
  }
}

/**
 * Release an uncaptured hold. Unlike a refund this is immediate — the customer
 * never sees money leave. Returns false if the booking was already captured,
 * in which case the caller still needs to refund.
 */
export async function releaseHold(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking?.stripePaymentIntentId || booking.capturedAt) return false;

  try {
    await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
    await prisma.booking.update({
      where: { id: bookingId },
      data: { authorizedAmount: null, authorizedAt: null, authExpiresAt: null },
    });
    return true;
  } catch (err) {
    console.error("[releaseHold]", bookingId, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Charge an approved add-on (extra time or supplemental work) to the saved
 * card as its own payment. Separate from the hold because Stripe will not let
 * us capture more than we authorized.
 */
export async function chargeAddOn(
  bookingId: string,
  amount: number,
  label: string
): Promise<{ ok: true; paymentIntentId: string } | { ok: false; reason: string }> {
  if (!(amount > 0)) return { ok: false, reason: "Amount must be positive" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { stripeCustomerId: true, defaultPaymentMethodId: true } } },
  });
  if (!booking) return { ok: false, reason: "Booking not found" };

  const { stripeCustomerId, defaultPaymentMethodId } = booking.customer;
  if (!stripeCustomerId || !defaultPaymentMethodId) {
    return { ok: false, reason: "No saved payment method" };
  }

  // The fee applies to labor; materials pass through at cost.
  const total = bookingTotal(amount, 0);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: toCents(total),
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: `Tarea add-on — ${label} (booking ${booking.id})`,
      metadata: { bookingId: booking.id, kind: "booking_addon" },
      statement_descriptor_suffix: DESCRIPTOR.materials,
    });
    if (intent.status !== "succeeded") {
      return { ok: false, reason: `Add-on charge not completed (${intent.status})` };
    }
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Add-on charge failed";
    console.error("[chargeAddOn]", bookingId, message);
    return { ok: false, reason: message };
  }
}
