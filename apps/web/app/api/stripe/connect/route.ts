import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPayoutAccount, stripeMode, syncPayoutStatus } from "@/lib/payout-account";
import { accountLinkUrls, returnTarget } from "@/lib/stripe-return-urls";

// POST /api/stripe/connect — create/resume onboarding link
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A body is optional here — the web dashboard posts nothing.
  const target = returnTarget(await req.json().catch(() => null));

  try {
    let accountId = user.stripeAccountId;

    // An account id stored under a different Stripe key is unusable and cannot
    // be migrated — accountLinks.create would just fail on it. Drop it and
    // onboard afresh, which is the only real remedy. This is how a pro who
    // connected while the app ran on test keys recovers after the switch to
    // live, instead of being stuck with an id nothing can pay.
    if (accountId) {
      const check = await checkPayoutAccount(accountId);
      if (!check.ok && check.reason === "wrong_mode") {
        console.error("[connect] discarding unusable account", JSON.stringify({
          userId: user.id, accountId, mode: stripeMode(), detail: check.detail,
        }));
        accountId = null;
      }
    }

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
      ...accountLinkUrls(target),
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start verification";
    return NextResponse.json({ error: message }, { status: 400 });
  }
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

  try {
    // Was `account.charges_enabled`, which is the wrong question. These Express
    // accounts request only the `transfers` capability, so a fully onboarded
    // payout account can report charges_enabled false and would be pinned to
    // "pending" for ever. syncPayoutStatus asks whether transfers are active,
    // matching checkPayoutAccount and every other payout decision.
    const status = await syncPayoutStatus(user);
    return NextResponse.json({ status, accountId: user.stripeAccountId });
  } catch (err: unknown) {
    // Do NOT leave a stale "active" behind. If the account cannot be read, the
    // stored status is not evidence of anything — it read "active" for four
    // accounts the live key could not see at all.
    const check = await checkPayoutAccount(user.stripeAccountId);
    if (!check.ok && check.reason === "wrong_mode") {
      await prisma.user
        .update({ where: { id: user.id }, data: { stripeAccountStatus: "pending" } })
        .catch(() => {});
      return NextResponse.json({
        status: "not_connected",
        error: "Your payout account needs to be set up again. Tap Connect to finish.",
      });
    }
    const message = err instanceof Error ? err.message : "Failed to retrieve account status";
    return NextResponse.json({ error: message, status: "error" }, { status: 400 });
  }
}
