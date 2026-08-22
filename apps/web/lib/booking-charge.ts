import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createNotification } from "@/lib/notify";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { assertPromoUsable, hasPriorPaidOrder } from "@/lib/promo";

// What a booking costs and how it gets collected — in one place, because the
// same amount is now taken two different ways: hosted Checkout (customer
// present) and an off-session charge against a saved card (customer absent,
// triggered by the pro accepting). Two copies of this arithmetic would mean a
// customer could be quoted one figure and charged another.

export type ChargeableBooking = {
  id: string;
  customerId: string;
  city: string;
  totalPrice: number;
  materialsEstimate: number;
  service: { title: string };
  promoCode: Parameters<typeof assertPromoUsable>[0] | null;
};

export type BookingAmounts = {
  discountAmount: number;
  discountedPrice: number;
  serviceFee: number;
  materials: number;
  totalCents: number;
};

/**
 * Re-validates the promo at payment time (expiry / maxUses / ownership), not
 * just isActive — a code that was valid when the booking was created may no
 * longer be usable by the time anyone pays.
 */
export async function bookingAmounts(booking: ChargeableBooking): Promise<BookingAmounts> {
  let discountAmount = 0;
  if (booking.promoCode) {
    // This booking is itself unpaid, so "prior paid order" correctly reflects
    // whether the customer has completed a payment before — which is what a
    // first-order-only code turns on.
    const prior = await hasPriorPaidOrder(booking.customerId);
    const check = assertPromoUsable(booking.promoCode, booking.customerId, booking.totalPrice, prior);
    if (check.ok) discountAmount = check.discountAmount;
  }
  const discountedPrice = Math.max(0, booking.totalPrice - discountAmount);
  const serviceFee = discountedPrice * CUSTOMER_FEE_RATE;
  const materials = booking.materialsEstimate > 0 ? booking.materialsEstimate : 0;
  return {
    discountAmount,
    discountedPrice,
    serviceFee,
    materials,
    totalCents: Math.round(discountedPrice * 100) + Math.round(serviceFee * 100) + Math.round(materials * 100),
  };
}

/** The Checkout line items for a booking, itemised the way the customer expects. */
export function bookingLineItems(
  booking: ChargeableBooking,
  amounts: BookingAmounts,
): Stripe.Checkout.SessionCreateParams["line_items"] {
  return [
    {
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amounts.discountedPrice * 100),
        product_data: {
          name: `${booking.service.title} (Labor)`,
          description: amounts.discountAmount > 0
            ? `Booking #${booking.id.slice(-8).toUpperCase()} — ${booking.city} · Promo applied: -$${amounts.discountAmount.toFixed(2)}`
            : `Booking #${booking.id.slice(-8).toUpperCase()} — ${booking.city}`,
        },
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amounts.serviceFee * 100),
        product_data: { name: "Service Fee (15%)" },
      },
      quantity: 1,
    },
    ...(amounts.materials > 0 ? [{
      price_data: {
        currency: "usd" as const,
        unit_amount: Math.round(amounts.materials * 100),
        product_data: {
          name: "Materials (estimated)",
          description: "Cost of materials required to complete the job. Handyman will provide receipts.",
        },
      },
      quantity: 1,
    }] : []),
  ];
}

/**
 * Records a booking as paid and tells both parties. Idempotent: the update is
 * conditional on the booking still being unpaid, so a webhook redelivery (or a
 * webhook racing the inline result of an off-session charge) cannot notify the
 * same people twice.
 *
 * Returns false when the booking was already paid.
 */
export async function markBookingPaid(bookingId: string, paymentIntentId: string | null): Promise<boolean> {
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, isPaid: false },
    data: { isPaid: true, ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}) },
  });
  if (count === 0) return false;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: { select: { title: true } } },
  });
  if (!booking) return false;

  await Promise.all([
    createNotification({
      userId: booking.customerId,
      title: "Payment confirmed ✓",
      body: `Your payment for "${booking.service.title}" was successful. Your booking is confirmed.`,
      type: "booking_accepted",
      refId: booking.id,
    }),
    createNotification({
      userId: booking.handymanId,
      title: "Job confirmed — customer paid ✓",
      body: `Payment for "${booking.service.title}" is secured with Tarea. This job is confirmed — you're good to go.`,
      type: "booking_accepted",
      refId: booking.id,
    }),
  ]);
  return true;
}

export type ChargeResult =
  | { ok: true; paymentIntentId: string }
  | { ok: false; reason: "no_card" | "requires_action" | "declined" | "error"; message?: string };

/**
 * Charges the customer's saved card for a booking without them present.
 *
 * This is what makes a pro's acceptance final: the card was saved with
 * off-session consent when the customer hired (SetupIntent, see
 * /api/stripe/setup-intent), so the moment the pro accepts we take the money
 * rather than sending the customer off to a payment page they might never open.
 *
 * Never throws — a failed charge must leave the booking accepted-but-unpaid and
 * fall back to the customer paying by hand, not blow up the pro's accept.
 */
export async function chargeSavedCardForBooking(bookingId: string): Promise<ChargeResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: { select: { title: true } }, promoCode: true },
  });
  if (!booking) return { ok: false, reason: "error", message: "Booking not found" };
  if (booking.isPaid) return { ok: false, reason: "error", message: "Already paid" };

  const customer = await prisma.user.findUnique({
    where: { id: booking.customerId },
    select: { stripeCustomerId: true, defaultPaymentMethodId: true },
  });
  if (!customer?.stripeCustomerId || !customer.defaultPaymentMethodId) {
    return { ok: false, reason: "no_card" };
  }

  const amounts = await bookingAmounts(booking);
  if (amounts.totalCents <= 0) return { ok: false, reason: "error", message: "Nothing to charge" };

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amounts.totalCents,
      currency: "usd",
      customer: customer.stripeCustomerId,
      payment_method: customer.defaultPaymentMethodId,
      // The customer is not here — this is the consent they gave when they hired.
      off_session: true,
      confirm: true,
      description: `${booking.service.title} — Booking #${booking.id.slice(-8).toUpperCase()}`,
      metadata: { bookingId: booking.id },
    });

    if (intent.status === "succeeded") {
      await markBookingPaid(booking.id, intent.id);
      return { ok: true, paymentIntentId: intent.id };
    }
    // requires_action means the bank wants 3-D Secure, which cannot be done
    // without the customer. They finish it on the hosted page instead.
    return { ok: false, reason: intent.status === "requires_action" ? "requires_action" : "declined" };
  } catch (err) {
    // Stripe throws its errors as values, not a shared exported type — read the
    // three fields that matter structurally rather than importing a class.
    const stripeErr = err as { code?: string; type?: string; message?: string };
    if (stripeErr?.code === "authentication_required") return { ok: false, reason: "requires_action" };
    if (stripeErr?.type === "StripeCardError") return { ok: false, reason: "declined", message: stripeErr.message };
    console.error("[booking-charge] Off-session charge failed:", err);
    return { ok: false, reason: "error", message: (err as Error)?.message };
  }
}
