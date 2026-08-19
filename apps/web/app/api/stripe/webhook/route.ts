import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { syncPayoutStatus } from "@/lib/payout-account";
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
    // A connected account finished (or lost) onboarding.
    //
    // Nothing used to listen for this, and the only code that marked a pro's
    // payouts active was GET /api/stripe/connect, which the app never calls.
    // So a pro who completed onboarding stayed "pending" for ever: they could
    // not apply for jobs and did not appear in Browse. This makes Stripe the
    // source of truth at the moment it changes, instead of waiting for the pro
    // to reopen the app.
    //
    // The account arrives on `event.account` for Connect events, and the
    // account object itself carries our userId in metadata; either can identify
    // the pro, so both are tried.
    if (event.type === "account.updated" || event.type === "capability.updated") {
      const accountId =
        event.account ??
        (event.type === "account.updated"
          ? (event.data.object as Stripe.Account).id
          : undefined);

      if (accountId) {
        let user = await prisma.user.findFirst({
          where: { stripeAccountId: accountId },
          select: { id: true, stripeAccountId: true, stripeAccountStatus: true },
        });

        // A pro whose id was never stored (onboarding abandoned midway, or the
        // row written after the event) is still recoverable through metadata.
        if (!user && event.type === "account.updated") {
          const metaUserId = (event.data.object as Stripe.Account).metadata?.userId;
          if (metaUserId) {
            user = await prisma.user.findUnique({
              where: { id: metaUserId },
              select: { id: true, stripeAccountId: true, stripeAccountStatus: true },
            });
            if (user && !user.stripeAccountId) {
              await prisma.user
                .update({ where: { id: user.id }, data: { stripeAccountId: accountId } })
                .catch(() => {});
              user = { ...user, stripeAccountId: accountId };
            }
          }
        }

        if (user) await syncPayoutStatus(user);
      }
      return NextResponse.json({ received: true });
    }

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

      // Handle tip payment
      if (session.metadata?.type === "tip") {
        const tipBookingId = session.metadata?.bookingId;
        const tipAmount = session.amount_total ? session.amount_total / 100 : 0;
        if (tipBookingId && tipAmount > 0) {
          const tipBooking = await prisma.booking.findUnique({
            where: { id: tipBookingId },
            include: { service: { select: { title: true } } },
          });
          if (tipBooking) {
            await prisma.tip.create({
              data: { bookingId: tipBookingId, amount: tipAmount, stripeSessionId: session.id },
            });
            await createNotification({
              userId: tipBooking.handymanId,
              title: `You received a $${tipAmount.toFixed(2)} tip! 🎉`,
              body: `A customer left you a tip for "${tipBooking.service.title}".`,
              type: "job_completed",
              refId: tipBookingId,
            });
          }
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

    // A card was saved for later use. Record it as the customer's default so
    // acceptance holds and add-on charges have something to charge off-session.
    if (event.type === "setup_intent.succeeded") {
      const si = event.data.object as Stripe.SetupIntent;
      const userId = si.metadata?.tareaUserId;
      const paymentMethodId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
      if (userId && paymentMethodId) {
        await prisma.user.update({
          where: { id: userId },
          data: { defaultPaymentMethodId: paymentMethodId },
        });
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
