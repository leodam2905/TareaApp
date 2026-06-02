import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 2900, // $29/month
          product_data: {
            name: "Tarea Pro — Handyman Membership",
          },
        },
        quantity: 1,
      },
    ],
    metadata: { userId: user.id },
    success_url: `${APP_URL}/handyman/profile?sub=success`,
    cancel_url: `${APP_URL}/handyman/profile?sub=cancel`,
  });

  return NextResponse.json({ url: session.url });
}

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: { isPremium: true, stripeSubStatus: true, stripeSubId: true },
  });

  return NextResponse.json({
    isPremium: profile?.isPremium ?? false,
    stripeSubStatus: profile?.stripeSubStatus ?? null,
    stripeSubId: profile?.stripeSubId ?? null,
  });
}

export async function DELETE(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: { stripeSubId: true, isPremium: true },
  });

  if (!profile?.stripeSubId || !profile.isPremium) {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  // Cancel at period end so handyman keeps access until billing cycle ends
  await stripe.subscriptions.update(profile.stripeSubId, { cancel_at_period_end: true });

  await prisma.handymanProfile.update({
    where: { userId: user.id },
    data: { stripeSubStatus: "canceling" },
  });

  return NextResponse.json({ ok: true, message: "Subscription will be cancelled at the end of the current billing period." });
}
