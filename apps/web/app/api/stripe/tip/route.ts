import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { bookingExtraReturnUrls, returnTarget } from "@/lib/stripe-return-urls";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bookingId, tipAmount } = body;
  const target = returnTarget(body);
  if (!bookingId || tipAmount == null) {
    return NextResponse.json({ error: "bookingId and tipAmount are required" }, { status: 400 });
  }

  const tip = Number(tipAmount);
  if (isNaN(tip) || tip <= 0 || tip > 200) {
    return NextResponse.json({ error: "tipAmount must be between $0.01 and $200" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: { select: { title: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "Booking must be completed to tip" }, { status: 400 });
  }
  if (!booking.isPaid) {
    return NextResponse.json({ error: "Booking must be paid before tipping" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(tip * 100),
          product_data: {
            name: `Tip for ${booking.service.title}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId,
      type: "tip",
    },
    ...bookingExtraReturnUrls(target, bookingId, "tip"),
  });

  return NextResponse.json({ url: session.url });
}
