import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { checkPayoutAccount } from "@/lib/payout-account";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Sends a pro into Stripe's own Express dashboard to manage payout methods.
//
// WHY THIS EXISTS
//
// The app used to collect a payout debit card itself: raw card[number] and
// card[cvc] posted to /v1/tokens with the publishable key. Stripe refuses that
// on this account —
//
//   "This integration surface is unsupported for publishable key tokenization"
//
// — because handling raw card numbers moves the platform from PCI SAQ-A to
// SAQ-D. It is an account policy, not a bug, and it fails identically in test
// and live. Bank accounts are not restricted, which is why only the debit-card
// button ever failed.
//
// Rather than take on SAQ-D scope to collect a card Stripe will collect for
// free, the pro is sent to Stripe. That also gets validation the app cannot do:
// Stripe checks the card is debit-capable and belongs to the account holder,
// which is a hard requirement for instant payouts.
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const check = await checkPayoutAccount(user.stripeAccountId);

  // No usable account yet — a login link would 400. Hand back onboarding
  // instead so the button still does something useful, and say which it is so
  // the app can word the screen correctly.
  if (!check.ok) {
    if (check.reason === "lookup_failed") {
      return NextResponse.json({ error: "Could not reach Stripe. Please try again." }, { status: 502 });
    }
    try {
      let accountId = user.stripeAccountId;
      if (!accountId || check.reason === "wrong_mode") {
        const account = await stripe.accounts.create({
          type: "express",
          email: user.email,
          capabilities: { transfers: { requested: true } },
          metadata: { userId: user.id },
        });
        accountId = account.id;
        const { prisma } = await import("@/lib/prisma");
        await prisma.user.update({
          where: { id: user.id },
          data: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
        });
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${APP_URL}/handyman/payout-methods?stripe=refresh`,
        return_url: `${APP_URL}/handyman/payout-methods?stripe=connected`,
        type: "account_onboarding",
      });
      return NextResponse.json({ url: link.url, kind: "onboarding" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start verification";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const link = await stripe.accounts.createLoginLink(user.stripeAccountId!);
    return NextResponse.json({ url: link.url, kind: "dashboard" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not open your Stripe dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
