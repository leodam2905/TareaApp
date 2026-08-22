import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { bookingAmounts, bookingLineItems } from "@/lib/booking-charge";
import { checkoutReturnUrls, returnTarget } from "@/lib/stripe-return-urls";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bookingId } = body;
  // Paying starts in the app but finishes in an external browser; without this
  // the customer was left on the website afterwards with no way back.
  const target = returnTarget(body);
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, promoCode: true },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Booking must be accepted before payment" }, { status: 400 });
  }
  if (booking.isPaid) {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  // Amounts (and the promo re-check) come from lib/booking-charge so that a
  // customer pays the same figure whether they are sent here or their saved
  // card is charged off-session when the pro accepts.
  const amounts = await bookingAmounts(booking);
  const lineItems = bookingLineItems(booking, amounts);

  const session = await stripe.checkout.sessions.create({
    // "card" ONLY. Apple Pay and Google Pay are not payment_method_types —
    // they are wallets Stripe surfaces automatically under "card" on an
    // eligible device. Listing them by name made every session creation fail
    // with `Invalid payment_method_types[1]`, so no customer could ever reach
    // a payment page. Adding them back does not add wallet support; it removes
    // payment entirely.
    payment_method_types: ["card"],
    payment_method_options: {
      card: { request_three_d_secure: "automatic" },
    },
    mode: "payment",
    line_items: lineItems,
    metadata: { bookingId: booking.id, userId: user.id },
    payment_intent_data: { metadata: { bookingId: booking.id } },
    custom_text: {
      submit: {
        message: "Your payment is held securely by Tarea and will only be transferred to the handyman once the job is marked as complete. You are protected throughout the process.",
      },
      after_submit: {
        message: "Thank you! Your funds are now held in escrow. The handyman will be paid only after you confirm the job is done.",
      },
    },
    ...checkoutReturnUrls(target, booking.id),
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
