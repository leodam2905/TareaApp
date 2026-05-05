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
    include: { service: true },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Booking must be accepted before payment" }, { status: 400 });
  }
  if (booking.isPaid) {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "apple_pay", "google_pay"],
    payment_method_options: {
      card: { request_three_d_secure: "automatic" },
    },
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(booking.totalPrice * 100),
          product_data: {
            name: booking.service.title,
            description: `Booking #${booking.id.slice(-8).toUpperCase()} — ${booking.city}`,
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(booking.totalPrice * CUSTOMER_FEE_RATE * 100),
          product_data: { name: "Tarea service fee (10%)" },
        },
        quantity: 1,
      },
    ],
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
