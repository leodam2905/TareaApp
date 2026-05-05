import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/stripe/connect — create/resume onboarding link
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accountId = user.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: { transfers: { requested: true } },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/handyman/profile?stripe=refresh`,
    return_url:  `${APP_URL}/handyman/profile?stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}

// GET /api/stripe/connect — return current connection status
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.stripeAccountId) {
    return NextResponse.json({ status: "not_connected" });
  }

  // Sync status from Stripe
  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  const status = account.charges_enabled ? "active" : "pending";

  if (status !== user.stripeAccountStatus) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountStatus: status },
    });
  }

  return NextResponse.json({ status, accountId: user.stripeAccountId });
}
