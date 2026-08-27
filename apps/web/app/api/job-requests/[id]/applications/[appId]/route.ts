import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unmetSteps } from "@/lib/pro-bookable";
import { stripe } from "@/lib/stripe";
import { hireAmounts } from "@/lib/hire";
import { assertPromoUsable, hasPriorPaidOrder } from "@/lib/promo";
import { hireReturnUrls, returnTarget } from "@/lib/stripe-return-urls";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; appId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobRequest = await prisma.jobRequest.findUnique({
    where: { id: params.id },
    include: { applications: true },
  });
  if (!jobRequest || jobRequest.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;
  // Paying starts in the app but finishes in an external browser; without this
  // the customer is left on the website afterwards with no way back.
  const target = returnTarget(body);

  // Hiring now returns a payment link instead of hiring outright, and an app
  // build older than that change ignores it: it would toast "Pro hired" while
  // nothing was paid and nobody was hired. Rather than break quietly on a
  // client we cannot update, a hire requires a caller that knows to follow the
  // link — the app sends platform, our own pages send client. This is what
  // lets the web half ship without waiting on store review.
  const hireCapableClient = body?.platform === "app" || body?.client === "web";

  // Ensure the application actually belongs to this job request (prevents
  // accepting/rejecting an application from a different customer's job request
  // by passing a foreign appId).
  if (!jobRequest.applications.some((a) => a.id === params.appId)) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Fetch (don't update yet) — the safety gate must run BEFORE we mark the
  // application accepted, so a blocked hire doesn't leave a phantom ACCEPTED
  // application with no booking.
  const application = await prisma.jobApplication.findUnique({
    where: { id: params.appId },
    include: { handyman: { include: { user: true } }, user: true },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (action === "accept") {
    if (!hireCapableClient) {
      return NextResponse.json(
        { error: "Please update the Tarea app to hire a pro — hiring now includes payment." },
        { status: 426 },
      );
    }

    // A request that already has a hired pro must not open a second payment.
    if (jobRequest.status !== "OPEN") {
      return NextResponse.json({ error: "This request already has a hired pro." }, { status: 409 });
    }

    // Bookable means all six onboarding steps complete — the same rule browse
    // filters on and applying asserts. Checked again here because this is the
    // moment a stranger is sent to somebody's home, and it must not depend on
    // an earlier surface having been correct.
    const handymanProfile = await prisma.handymanProfile.findUnique({
      where: { id: application.handymanId },
      select: { backgroundCheckStatus: true, icaSignedAt: true, bio: true, idFrontUrl: true },
    });
    const handymanUserRecord = await prisma.user.findUnique({
      where: { id: application.user.id },
      select: { avatarUrl: true, stripeAccountStatus: true },
    });
    const [hmServices, hmAvailability] = await Promise.all([
      prisma.service.count({ where: { handymanId: application.handymanId } }),
      prisma.handymanAvailability.count({ where: { profileId: application.handymanId } }),
    ]);
    const proMissing = unmetSteps({
      avatarUrl: handymanUserRecord?.avatarUrl ?? null,
      stripeAccountStatus: handymanUserRecord?.stripeAccountStatus ?? null,
      profile: handymanProfile
        ? {
            icaSignedAt: handymanProfile.icaSignedAt,
            bio: handymanProfile.bio,
            idFrontUrl: handymanProfile.idFrontUrl,
            backgroundCheckStatus: handymanProfile.backgroundCheckStatus as string,
            servicesCount: hmServices,
            availabilityCount: hmAvailability,
          }
        : null,
    });
    if (proMissing.length > 0) {
      return NextResponse.json(
        { error: "This Pro has not finished setting up and cannot be booked yet." },
        { status: 400 },
      );
    }

    // Gate passed — now collect the money. NOTHING is decided until Stripe
    // confirms it: no application is accepted, no runner-up is rejected, the
    // request stays OPEN and the pro is told nothing. Hiring is paying, so a
    // customer who closes the payment page has simply not hired anybody.
    // The booking itself is created from the webhook (see lib/hire.ts).
    // A promo code sent with the hire. TAREA20 — 20% off a first order — was
    // advertised on the home screen and in the store listing but could never be
    // redeemed on this path: hiring computed its own totals and never looked at
    // a code, and the only place promos applied was the directed-booking
    // checkout. The rules come from assertPromoUsable, the same function
    // checkout uses, so a code cannot be valid on one path and not the other.
    let promoCodeId: string | null = null;
    let discount = 0;
    if (typeof body?.promoCode === "string" && body.promoCode.trim()) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: body.promoCode.trim().toUpperCase() },
      });
      if (promo) {
        const prior = await hasPriorPaidOrder(user.id);
        const check = assertPromoUsable(promo, user.id, jobRequest.budgetMin ?? 0, prior);
        if (!check.ok) {
          // Told, not swallowed: a customer who typed a code deserves to know
          // why it did not apply rather than seeing an unchanged total.
          return NextResponse.json({ error: check.error ?? "That promo code cannot be used." }, { status: 400 });
        }
        discount = check.discountAmount;
        promoCodeId = promo.id;
      } else {
        return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
      }
    }

    const { labour, serviceFee, materials, discount: applied } = hireAmounts(
      jobRequest.budgetMin ?? 0,
      application.materialsEstimate ?? jobRequest.materialsCost ?? 0,
      discount,
    );
    if (labour <= 0) {
      return NextResponse.json({ error: "This job has no price set and cannot be paid for." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      // "card" ONLY — Apple Pay and Google Pay are wallets Stripe surfaces
      // under "card", not payment_method_types. Naming them makes every
      // session creation fail. See /api/stripe/checkout.
      payment_method_types: ["card"],
      payment_method_options: { card: { request_three_d_secure: "automatic" } },
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(labour * 100),
            product_data: {
              name: `${jobRequest.title} (Labor)`,
              description: applied > 0
                ? `${application.user.name} — ${jobRequest.city} · Promo applied: -$${applied.toFixed(2)}`
                : `${application.user.name} — ${jobRequest.city}`,
            },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(serviceFee * 100),
            product_data: { name: "Service Fee (15%)" },
          },
          quantity: 1,
        },
        ...(materials > 0 ? [{
          price_data: {
            currency: "usd" as const,
            unit_amount: Math.round(materials * 100),
            product_data: {
              name: "Materials",
              description: "Materials for this job, quoted by your pro and charged at cost with no service fee.",
            },
          },
          quantity: 1,
        }] : []),
      ],
      // How the webhook knows this payment is a hire rather than a booking that
      // already exists.
      metadata: {
        type: "hire",
        jobRequestId: params.id,
        applicationId: params.appId,
        userId: user.id,
        ...(promoCodeId ? { promoCodeId } : {}),
      },
      payment_intent_data: {
        metadata: { type: "hire", jobRequestId: params.id, applicationId: params.appId },
      },
      custom_text: {
        submit: {
          message: "Paying confirms the hire. Your payment is held securely by Tarea and is only transferred to the handyman once the job is complete.",
        },
        after_submit: {
          message: "Thank you! Your pro is confirmed and has been notified. Tarea holds the funds until you confirm the job is done.",
        },
      },
      ...hireReturnUrls(target),
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
  } else {
    await prisma.jobApplication.update({ where: { id: params.appId }, data: { status: "REJECTED" } });
    await createNotification({
      userId: application.user.id,
      title: "Application Not Selected",
      body: `The customer chose another handyman for "${jobRequest.title}".`,
      type: "booking_request",
      refId: jobRequest.id,
    });
  }

  return NextResponse.json({ ok: true });
}
