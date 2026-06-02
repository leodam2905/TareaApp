import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { sendInvoiceEmail } from "@/lib/email";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      handyman: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      review: true,
      phases: { orderBy: { startedAt: "asc" } },
      extensions: { orderBy: { createdAt: "desc" } },
      messages: {
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, cancelReason } = await req.json();
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { title: true, category: true } },
      customer: { select: { email: true, name: true } },
      handyman: { select: { name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: {
      status,
      cancelReason,
      ...(status === "IN_PROGRESS" && !booking.jobStartedAt && { jobStartedAt: new Date() }),
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  if (status === "COMPLETED") {
    await prisma.handymanProfile.updateMany({
      where: { userId: booking.handymanId },
      data: { totalEarnings: { increment: handymanNet(booking.totalPrice) } },
    });

    // Send invoice email to customer
    try {
      await sendInvoiceEmail({
        to: booking.customer.email,
        bookingId: booking.id,
        serviceTitle: booking.service.title,
        serviceCategory: booking.service.category,
        handymanName: booking.handyman.name,
        scheduledAt: booking.scheduledAt,
        address: booking.address,
        city: booking.city,
        totalPrice: booking.totalPrice,
      });
    } catch (err) {
      console.error("[bookings/PATCH] Invoice email failed:", err);
    }

    // Auto-transfer net earnings to handyman's Stripe Connect account
    const handymanUser = await prisma.user.findUnique({ where: { id: booking.handymanId } });
    if (handymanUser?.stripeAccountId && handymanUser.stripeAccountStatus === "active" && booking.isPaid) {
      try {
        await stripe.transfers.create({
          amount: Math.round(handymanNet(booking.totalPrice) * 100),
          currency: "usd",
          destination: handymanUser.stripeAccountId,
          transfer_group: booking.id,
        });
        await prisma.booking.update({
          where: { id: params.id },
          data: { handymanPaidOut: true },
        });
      } catch (err) {
        console.error("[bookings/PATCH] Stripe transfer failed:", err);
      }
    }
  }

  // Auto-refund if a paid booking is cancelled — 50% fee if within 24h of scheduledAt
  let refundNote = "";
  if (status === "CANCELLED" && booking.isPaid && booking.stripePaymentIntentId) {
    try {
      const hoursUntil = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        // Late cancellation: partial refund (50% of what customer paid incl. fee)
        const refundAmount = Math.round(booking.totalPrice * 1.10 * 0.50 * 100);
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: refundAmount,
        });
        refundNote = " 50% cancellation fee applied. Partial refund issued within 5-10 days.";

        // Pay handyman 50% of their net if they have Stripe Connect active
        const handymanUser = await prisma.user.findUnique({ where: { id: booking.handymanId } });
        if (handymanUser?.stripeAccountId && handymanUser.stripeAccountStatus === "active") {
          try {
            const handymanAmount = Math.round(booking.totalPrice * 0.90 * 0.50 * 100);
            await stripe.transfers.create({
              amount: handymanAmount,
              currency: "usd",
              destination: handymanUser.stripeAccountId,
              transfer_group: booking.id,
            });
          } catch (err) {
            console.error("[bookings/PATCH] Late-cancel handyman transfer failed:", err);
          }
        }
      } else {
        // Early cancellation: full refund
        await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
        refundNote = " Full refund issued within 5-10 days.";
      }
    } catch (err) {
      console.error("[bookings/PATCH] Refund failed:", err);
    }
  }

  const notifyUserId = user.id === booking.customerId ? booking.handymanId : booking.customerId;

  // When handyman accepts, tell customer to pay
  const acceptBody = user.role === "HANDYMAN" && status === "ACCEPTED"
    ? "Your booking was accepted! Open your bookings to complete payment."
    : `Your booking has been marked as ${status.toLowerCase()}.${refundNote}`; // refundNote includes fee/refund info

  await createNotification({
    userId: notifyUserId,
    title: status === "ACCEPTED" ? "Booking accepted — payment required" : `Booking ${status.toLowerCase()}`,
    body: acceptBody,
    type: status === "CANCELLED" ? "booking_cancelled" : "booking_accepted",
    refId: booking.id,
  });

  return NextResponse.json(updated);
}
