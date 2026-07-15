import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// PATCH — customer approves or declines the extension
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; extId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { service: { select: { title: true } } },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const extension = await prisma.bookingExtension.findUnique({ where: { id: params.extId } });
  if (!extension || extension.bookingId !== params.id) {
    return NextResponse.json({ error: "Extension not found" }, { status: 404 });
  }
  if (extension.status !== "PENDING") {
    return NextResponse.json({ error: "Extension already responded to" }, { status: 400 });
  }

  const { action } = await req.json();
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'approve' or 'decline'" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.bookingExtension.update({
    where: { id: params.extId },
    data: { status: action === "approve" ? "APPROVED" : "DECLINED", respondedAt: now },
  });

  let checkoutUrl: string | null = null;

  if (action === "approve") {
    // Shift scheduledAt forward by additionalMinutes
    const newScheduledAt = new Date(booking.scheduledAt.getTime() + extension.additionalMinutes * 60 * 1000);

    if (extension.extraAmount > 0 && booking.isPaid) {
      // Booking already paid — create a supplementary Stripe session for the extra amount
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: Math.round(extension.extraAmount * 100),
            product_data: {
              name: `Time extension — ${booking.service.title}`,
              description: extension.reason ?? `Additional ${extension.additionalMinutes} minutes`,
            },
          },
          quantity: 1,
        }],
        metadata: { bookingId: booking.id, type: "extension", extId: params.extId },
        success_url: `${APP_URL}/customer/bookings/${booking.id}?ext=paid`,
        cancel_url:  `${APP_URL}/customer/bookings/${booking.id}`,
      });
      checkoutUrl = session.url;

      await prisma.booking.update({
        where: { id: params.id },
        data: { scheduledAt: newScheduledAt },
      });
    } else {
      // Not yet paid — just fold extra into totalPrice
      await prisma.booking.update({
        where: { id: params.id },
        data: {
          scheduledAt: newScheduledAt,
          ...(extension.extraAmount > 0 && { totalPrice: { increment: extension.extraAmount } }),
        },
      });
    }

    const hours = Math.floor(extension.additionalMinutes / 60);
    const mins = extension.additionalMinutes % 60;
    const timeLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
    const extraLabel = extension.extraAmount > 0
      ? booking.isPaid ? ` Payment link sent.` : ` $${extension.extraAmount.toFixed(2)} added to your total.`
      : "";

    await createNotification({
      userId: booking.handymanId,
      title: "Extension approved ✓",
      body: `Customer approved your ${timeLabel} extension for "${booking.service.title}".${extraLabel}`,
      type: "booking_accepted",
      refId: booking.id,
    });
  } else {
    await createNotification({
      userId: booking.handymanId,
      title: "Extension declined",
      body: `Customer declined your time extension request for "${booking.service.title}".`,
      type: "booking_accepted",
      refId: booking.id,
    });
  }

  return NextResponse.json({ ...updated, checkoutUrl });
}
