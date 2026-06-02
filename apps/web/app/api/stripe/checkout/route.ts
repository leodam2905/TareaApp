import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await req.json();
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

  // Apply promo code discount if present and active
  let discountAmount = 0;
  if (booking.promoCode && booking.promoCode.isActive) {
    if (booking.promoCode.discountType === "PERCENT") {
      discountAmount = booking.totalPrice * (booking.promoCode.discountValue / 100);
    } else {
      discountAmount = Math.min(booking.promoCode.discountValue, booking.totalPrice);
    }
  }
  const discountedPrice = Math.max(0, booking.totalPrice - discountAmount);
  const serviceFee = discountedPrice * CUSTOMER_FEE_RATE;

  const lineItems: Parameters<typeof stripe.checkout.sessions.create>[0]["line_items"] = [
    {
      price_data: {
        currency: "usd",
        unit_amount: Math.round(discountedPrice * 100),
        product_data: {
          name: `${booking.service.title} (Labor)`,
          description: discountAmount > 0
            ? `Booking #${booking.id.slice(-8).toUpperCase()} — ${booking.city} · Promo applied: -$${discountAmount.toFixed(2)}`
            : `Booking #${booking.id.slice(-8).toUpperCase()} — ${booking.city}`,
        },
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        unit_amount: Math.round(serviceFee * 100),
        product_data: { name: "Tarea service fee (15% of labor)" },
      },
      quantity: 1,
    },
    ...(booking.materialsEstimate > 0 ? [{
      price_data: {
        currency: "usd",
        unit_amount: Math.round(booking.materialsEstimate * 100),
        product_data: {
          name: "Materials (estimated)",
          description: "Cost of materials required to complete the job. Handyman will provide receipts.",
        },
      },
      quantity: 1,
    }] : []),
  ];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "apple_pay", "google_pay"],
    payment_method_options: {
      card: { request_three_d_secure: "automatic" },
    },
    mode: "payment",
    line_items: lineItems,
    metadata: { bookingId: booking.id, userId: user.id },
    payment_intent_data: { metadata: { bookingId: booking.id } },
    success_url: `${APP_URL}/customer/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/customer/bookings/${booking.id}`,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
