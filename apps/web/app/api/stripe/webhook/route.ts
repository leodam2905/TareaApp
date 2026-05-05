import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import Stripe from "stripe";

// Raw body needed for signature verification
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.arrayBuffer();
    event = stripe.webhooks.constructEvent(Buffer.from(rawBody), sig ?? "", webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Log event for admin monitoring (ignore duplicate delivery)
  await prisma.stripeWebhookEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, type: event.type, payload: event as object },
    update: {},
  }).catch(() => {});

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Handle subscription checkout
      if (session.mode === "subscription") {
        const userId = session.metadata?.userId;
        if (userId) {
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
          await prisma.handymanProfile.updateMany({
            where: { userId },
            data: {
              isPremium: true,
              stripeSubId: subId,
              stripeSubStatus: "active",
            },
          });
        }
        return NextResponse.json({ ok: true });
      }

      // Handle background check payment
      if (session.metadata?.type === "background_check") {
        const userId = session.metadata?.userId;
        if (userId) {
          await prisma.handymanProfile.updateMany({
            where: { userId },
            data: {
              backgroundCheckStatus: "IN_PROGRESS",
              backgroundCheckPaidAt: new Date(),
            },
          });
          await createNotification({
            userId,
            title: "Background check initiated ✓",
            body: "Payment received. Your background check is now in progress — usually takes 1–3 business days.",
            type: "booking_accepted",
            refId: userId,
          });
        }
        return NextResponse.json({ ok: true });
      }

      // Handle payment checkout
      const bookingId = session.metadata?.bookingId;
      if (!bookingId) return NextResponse.json({ ok: true });

      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

      const booking = await prisma.booking.update({
        where: { id: bookingId },
        data: { isPaid: true, stripePaymentIntentId: paymentIntentId },
        include: { service: true },
      });

      await Promise.all([
        createNotification({
          userId: booking.customerId,
          title: "Payment confirmed ✓",
          body: `Your payment of $${booking.totalPrice.toFixed(2)} for "${booking.service.title}" was successful.`,
          type: "booking_accepted",
          refId: booking.id,
        }),
        createNotification({
          userId: booking.handymanId,
          title: "Customer paid ✓",
          body: `Payment received for "${booking.service.title}". You're good to go!`,
          type: "booking_accepted",
          refId: booking.id,
        }),
      ]);
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
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;
      if (paymentIntentId) {
        await prisma.booking.updateMany({
          where: { stripePaymentIntentId: paymentIntentId },
          data: { isPaid: false },
        });
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    await prisma.stripeWebhookEvent.updateMany({
      where: { eventId: event.id },
      data: { status: "failed" },
    }).catch(() => {});
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
