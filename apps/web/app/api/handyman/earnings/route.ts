import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { proOwedForAll } from "@/lib/pro-payout";
import { stripe } from "@/lib/stripe";
import { INSTANT_MIN_COMPLETED_JOBS } from "@/lib/instant-payout";

// The pro app's earnings summary.
//
// THIS ROUTE DID NOT EXIST. Both pro_dashboard.dart and pro_earnings.dart have
// always called /handyman/earnings, which 404'd; each wraps the call in a bare
// `catch (_) {}`, so every pro has been shown $0 earned, $0 pending and 0 jobs
// no matter what they had actually done. /api/earnings exists but returns a
// four-week chart array — a different shape for a different screen — so nothing
// was serving this.
//
// Amounts come from proOwedForAll, the same definition completion, the weekly
// cron, admin payout and instant cashout use: labour net of the platform fee,
// plus materials at cost. A second arithmetic here is how a pro ends up seeing
// one number in the app and being paid another.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Handymen only" }, { status: 403 });
  }

  const completed = await prisma.booking.findMany({
    where: { handymanId: user.id, status: "COMPLETED" },
    select: { totalPrice: true, materialsEstimate: true, materialsActual: true, handymanPaidOut: true },
  });

  // Tips carry no commission — 100% goes to the pro — so they are added whole
  // and never run through the fee calculation.
  const tips = await prisma.tip.findMany({
    where: { booking: { handymanId: user.id } },
    select: { amount: true, createdAt: true },
  });
  const tipTotal = Math.round(tips.reduce((s, t) => s + t.amount, 0) * 100) / 100;

  // What Stripe will ACTUALLY let them withdraw right now.
  //
  // Earnings computed from completed bookings are what the pro has EARNED; that
  // is not the same as money they can take out. A card charge settles in about
  // two business days and a payout cannot draw on unsettled funds — so a screen
  // showing one number and calling it "available" promises a cash-out Stripe
  // will refuse. Reporting both is the difference between a pro feeling misled
  // and a pro reading a normal bank delay.
  //
  // The connected account is addressed through request options (Stripe-Account
  // header), not a body parameter.
  let withdrawableNow: number | null = null;
  let clearingSoon: number | null = null;
  if (user.stripeAccountId) {
    try {
      const balance = await stripe.balance.retrieve({}, { stripeAccount: user.stripeAccountId });
      const sum = (rows: { amount: number }[]) => Math.round(rows.reduce((t, r) => t + r.amount, 0)) / 100;
      withdrawableNow = sum(balance.available);
      clearingSoon = sum(balance.pending);
    } catch (err) {
      // A failed lookup must not blank the screen — null means "unknown", which
      // the client renders differently from zero.
      console.warn("[handyman/earnings] balance lookup failed:", err);
    }
  }

  const paidOut = completed.filter((b) => b.handymanPaidOut);
  const awaiting = completed.filter((b) => !b.handymanPaidOut);

  return NextResponse.json({
    // Everything earned on completed work, whether or not it has been paid out.
    totalEarnings: Math.round((proOwedForAll(completed) + tipTotal) * 100) / 100,
    // Earned but not yet transferred — what the pro is still waiting on.
    pendingEarnings: proOwedForAll(awaiting),
    paidOutEarnings: proOwedForAll(paidOut),
    tipEarnings: tipTotal,
    totalJobs: completed.length,
    // The app shows "Connected" vs "Set up bank" from this.
    stripeAccountStatus: user.stripeAccountStatus ?? "",
    // Straight from Stripe. null when unknown — never conflated with zero.
    withdrawableNow,
    clearingSoon,
    // Progress towards instant cash-out, so the earnings screen can set the
    // expectation instead of leaving pros to guess. Reported here rather than
    // from /handyman/cashout because this is the screen a pro actually opens
    // to ask "when do I get paid".
    instantJobsCompleted: completed.length,
    instantJobsRequired: INSTANT_MIN_COMPLETED_JOBS,
  });
}
