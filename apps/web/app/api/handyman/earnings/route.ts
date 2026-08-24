import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { proOwedForAll } from "@/lib/pro-payout";

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
    select: { totalPrice: true, materialsEstimate: true, handymanPaidOut: true },
  });

  // Tips carry no commission — 100% goes to the pro — so they are added whole
  // and never run through the fee calculation.
  const tips = await prisma.tip.findMany({
    where: { booking: { handymanId: user.id } },
    select: { amount: true, createdAt: true },
  });
  const tipTotal = Math.round(tips.reduce((s, t) => s + t.amount, 0) * 100) / 100;

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
  });
}
