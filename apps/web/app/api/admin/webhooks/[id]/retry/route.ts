import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createNotification } from "@/lib/notify";
import Stripe from "stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.stripeWebhookEvent.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const event = await stripe.events.retrieve(record.eventId);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription") {
        const userId = session.metadata?.userId;
        if (userId) {
          const subId = typeof session.subscription === "string"
            ? session.subscription : session.subscription?.id ?? null;
          await prisma.handymanProfile.updateMany({
            where: { userId },
            data: { isPremium: true, stripeSubId: subId, stripeSubStatus: "active" },
          });
        }
      } else {
        const bookingId = session.metadata?.bookingId;
        if (bookingId) {
          const piId = typeof session.payment_intent === "string"
            ? session.payment_intent : session.payment_intent?.id ?? null;
          const booking = await prisma.booking.update({
            where: { id: bookingId },
            data: { isPaid: true, stripePaymentIntentId: piId },
            include: { service: true },
          });
          await Promise.all([
            createNotification({ userId: booking.customerId, title: "Payment confirmed ✓", body: `Payment for "${booking.service.title}" was successful.`, type: "booking_accepted", refId: booking.id }),
            createNotification({ userId: booking.handymanId, title: "Customer paid ✓", body: `Payment received for "${booking.service.title}".`, type: "booking_accepted", refId: booking.id }),
          ]);
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.handymanProfile.updateMany({
        where: { stripeSubId: sub.id },
        data: { isPremium: false, stripeSubStatus: sub.status },
      });
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.status !== "active") {
        await prisma.handymanProfile.updateMany({
          where: { stripeSubId: sub.id },
          data: { isPremium: false, stripeSubStatus: sub.status },
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const piId = typeof charge.payment_intent === "string"
        ? charge.payment_intent : charge.payment_intent?.id ?? null;
      if (piId) {
        await prisma.booking.updateMany({
          where: { stripePaymentIntentId: piId },
          data: { isPaid: false },
        });
      }
    }

    await prisma.stripeWebhookEvent.update({
      where: { id: params.id },
      data: { status: "processed" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook retry]", err);
    await prisma.stripeWebhookEvent.update({
      where: { id: params.id },
      data: { status: "failed" },
    }).catch(() => {});
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}
