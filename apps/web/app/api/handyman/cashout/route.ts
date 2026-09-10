import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { proOwedFor, proOwedForAll, payoutIdempotencyKey, unpaidTipsWhere, tipTotal } from "@/lib/pro-payout";
import { createNotification } from "@/lib/notify";
import { BACKGROUND_CHECK_FEE, bgCheckDeductionFor } from "@/lib/background-check";
import { checkInstantEligibility, instantBlockedMessage } from "@/lib/instant-payout";

export const MIN_CASHOUT = 10;

// 1% instant fee, min $0.50
export function calcInstantFee(amount: number) {
  return Math.max(0.5, amount * 0.01);
}

// GET — available balance
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [unpaid, paid, pendingTips, activeDisputes, completedJobs] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false, payoutHold: false },
      select: { id: true, totalPrice: true, materialsEstimate: true, materialsActual: true, completedAt: true, service: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", handymanPaidOut: true },
      select: { id: true, totalPrice: true, materialsEstimate: true, materialsActual: true, paidOutAt: true, service: { select: { title: true } } },
      orderBy: { paidOutAt: "desc" },
      take: 20,
    }),
    prisma.tip.findMany({
      where: unpaidTipsWhere(user.id),
      select: { amount: true },
    }),
    prisma.booking.count({
      where: { handymanId: user.id, status: "DISPUTED" },
    }),
    // Lifetime completed jobs, not just the 20 shown as history — the instant
    // threshold is about a pro's track record, so it must count all of it.
    prisma.booking.count({
      where: { handymanId: user.id, status: "COMPLETED" },
    }),
  ]);

  const bookingEarnings = proOwedForAll(unpaid);
  const tipEarnings = tipTotal(pendingTips);
  const available = bookingEarnings + tipEarnings;

  // Asked BEFORE the pro commits to anything. Offering instant cash-out and
  // discovering at the last step that their card cannot take it wastes the one
  // moment they actually wanted the money quickly.
  const instant = await checkInstantEligibility(user.stripeAccountId, completedJobs);

  return NextResponse.json({
    available,
    tipEarnings,
    activeDisputes,
    minCashout: MIN_CASHOUT,
    instantFee: calcInstantFee(available),
    instantAvailable: instant.eligible,
    instantCardLast4: instant.cardLast4 ?? null,
    // Null when eligible — the app shows the button instead of a reason.
    instantBlockedReason: instant.eligible ? null : instant.reason ?? null,
    instantBlockedMessage: instant.eligible ? null : instantBlockedMessage(instant.reason, instant),
    // Progress towards the threshold, so the app can show "12 of 30" rather
    // than only saying no.
    instantJobsCompleted: instant.jobsCompleted ?? completedJobs,
    instantJobsRequired: instant.jobsRequired ?? null,
    stripeStatus: user.stripeAccountStatus ?? "not_connected",
    pendingBookings: unpaid.map(b => ({
      id: b.id,
      service: b.service.title,
      net: proOwedFor(b),
      completedAt: b.completedAt,
    })),
    payoutHistory: paid.map(b => ({
      id: b.id,
      service: b.service.title,
      net: proOwedFor(b),
      paidOutAt: b.paidOutAt,
    })),
  });
}

// POST — instant cashout to debit card
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeAccountId || user.stripeAccountStatus !== "active") {
    return NextResponse.json(
      { error: "Connect your bank account via Stripe before cashing out." },
      { status: 400 }
    );
  }

  const [pending, activeDisputes, pendingTips] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false, payoutHold: false },
    }),
    prisma.booking.count({ where: { handymanId: user.id, status: "DISPUTED" } }),
    prisma.tip.findMany({
      where: unpaidTipsWhere(user.id),
      select: { id: true, amount: true },
    }),
  ]);

  if (activeDisputes > 0) {
    return NextResponse.json(
      { error: `You have ${activeDisputes} disputed booking${activeDisputes > 1 ? "s" : ""} under review. Payouts are frozen until all disputes are resolved.` },
      { status: 400 }
    );
  }

  // Tips count as earnings on their own. Requiring an unpaid BOOKING as well
  // refused every pro whose only outstanding money was tips — which, since a
  // completed booking pays out immediately and only a completed booking can be
  // tipped, is the ordinary case rather than an edge one.
  if (pending.length === 0 && pendingTips.length === 0) {
    return NextResponse.json({ error: "No earnings available to cash out." }, { status: 400 });
  }

  const tips = tipTotal(pendingTips);
  // Everything the pro is owed: labour net, materials at cost, and tips.
  // The instant fee is charged on this whole total, per the pricing rule
  // that the pro bears the cost of the amount they choose to move.
  const gross = proOwedForAll(pending) + tips;

  if (gross < MIN_CASHOUT) {
    return NextResponse.json(
      { error: `Minimum cashout is $${MIN_CASHOUT}. You have $${gross.toFixed(2)} available.` },
      { status: 400 }
    );
  }

  // Deduct the background check fee from the first payout that can carry it.
  // Shared with the weekly cron so the two paths cannot disagree about when the
  // fee is owed.
  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  const bg = bgCheckDeductionFor(
    profile?.backgroundCheckStatus,
    gross,
    // Must still cover the instant fee and leave a payable amount behind.
    calcInstantFee(gross) + 1,
  );
  if (bg.deferredAgain) {
    // Instant cashout is a deliberate request for a specific amount, so it says
    // no rather than quietly paying out and leaving the fee outstanding. The
    // weekly cron, which the pro did not ask for, pays and waits instead.
    return NextResponse.json(
      { error: `Your first payout must cover the $${BACKGROUND_CHECK_FEE} background check fee. Earn more before cashing out.` },
      { status: 400 }
    );
  }
  const bgCheckDeduction = bg.amount;

  const fee = calcInstantFee(gross);
  const net = gross - fee - bgCheckDeduction;

  // Move platform → connected account, WITHOUT the background-check deduction.
  //
  // Transferring the full gross and then paying out less left the deduction
  // sitting in the pro's own Stripe balance, where their next scheduled payout
  // simply handed it back to them — Tarea never actually recouped the fee. It
  // is retained by not sending it.
  //
  // The 1% instant fee IS still transferred: it stays in the connected balance
  // on purpose, because that is where Stripe charges its own instant-payout fee.
  // Refused here, before anything moves.
  //
  // Falling through to the transfer would mark these jobs paid and sweep the
  // earnings into the pro's balance, where the weekly payout collects them —
  // so a pro who asked for instant, and could have had it by adding a debit
  // card, would instead lose the option on those earnings permanently. A
  // lookup failure is deliberately NOT treated as ineligible: unknown means
  // let them try, and the payout leg below fails safely if it cannot run.
  const completedJobs = await prisma.booking.count({
    where: { handymanId: user.id, status: "COMPLETED" },
  });
  const instant = await checkInstantEligibility(user.stripeAccountId, completedJobs);
  if (!instant.eligible && instant.reason !== "lookup_failed") {
    return NextResponse.json(
      { error: instantBlockedMessage(instant.reason, instant), reason: instant.reason },
      { status: 400 },
    );
  }

  const bookingIds = pending.map(b => b.id);
  const tipIds = pendingTips.map(t => t.id);
  // Tips are part of what moves, so they are part of what the key identifies.
  const payoutIds = [...bookingIds, ...tipIds.map(id => `tip:${id}`)];
  await stripe.transfers.create(
    {
      amount: Math.round((gross - bgCheckDeduction) * 100),
      currency: "usd",
      destination: user.stripeAccountId,
      description: `Tarea instant cashout — ${pending.length} job${pending.length > 1 ? "s" : ""}`,
      metadata: { handymanId: user.id },
    },
    { idempotencyKey: payoutIdempotencyKey(payoutIds, "instant") },
  );

  // Marked paid HERE, on the transfer, not after the payout below.
  //
  // These ran back to back with no error handling at all: an instant payout
  // that threw — no debit card on file, funds not yet in the available
  // balance, instant not supported for the account, all routine — became a 500
  // AFTER the transfer had already landed. The bookings stayed flagged unpaid,
  // so the same jobs could be cashed out again and transferred twice. The
  // transfer is what moves Tarea's money; that is what the flag records.
  const now = new Date();
  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: { handymanPaidOut: true, paidOutAt: now },
  });
  // Same reasoning as the bookings above: the transfer is what moved the money,
  // so the transfer is what the flag records. Without this the same tips are
  // swept and sent a second time on the pro's next cashout.
  if (tipIds.length > 0) {
    await prisma.tip.updateMany({ where: { id: { in: tipIds } }, data: { paidOutAt: now } });
  }

  // Push net (after fee) from connected account balance → debit card instantly.
  // Non-fatal: the money is already the pro's inside Stripe, so a failure here
  // means it arrives on their normal payout schedule instead of in minutes.
  let instantSent = true;
  try {
    await stripe.payouts.create(
      {
        amount: Math.round(net * 100),
        currency: "usd",
        method: "instant",
        description: "Tarea instant cashout",
        metadata: { handymanId: user.id },
      },
      {
        stripeAccount: user.stripeAccountId,
        idempotencyKey: payoutIdempotencyKey(payoutIds, "instant-payout"),
      },
    );
  } catch (err) {
    instantSent = false;
    console.warn(`[cashout] instant payout failed for ${user.id}:`, err);
  }

  // Mark background check as paid if it was deferred
  if (bgCheckDeduction > 0) {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: { backgroundCheckStatus: "IN_PROGRESS", backgroundCheckPaidAt: now },
    });
  }

  const bgNote = bgCheckDeduction > 0 ? ` (includes $${bgCheckDeduction.toFixed(2)} background check deduction)` : "";
  await createNotification({
    userId: user.id,
    // A pro who is told "arrives within 30 minutes" and sees nothing has been
    // lied to about their own money — and the instant leg is the one that
    // routinely fails. Say which of the two actually happened.
    title: instantSent ? "Instant Payout Sent" : "Earnings Released",
    body: instantSent
      ? `$${net.toFixed(2)} is on its way to your debit card — arrives within 30 minutes. ($${fee.toFixed(2)} instant fee${bgNote})`
      : `$${net.toFixed(2)} has been released to your Tarea balance${bgNote}. The instant transfer to your debit card did not go through, so it will arrive on your next scheduled payout. You were not charged the instant fee.`,
    type: "payout",
  });

  return NextResponse.json({
    success: true,
    instant: instantSent,
    gross,
    // The instant fee is only earned if the instant leg ran. Reporting it when
    // the payout failed would show a charge for a service not delivered.
    fee: instantSent ? fee : 0,
    bgCheckDeduction,
    net: instantSent ? net : net + fee,
    count: pending.length,
  });
}
