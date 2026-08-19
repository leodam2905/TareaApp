import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { proOwedFor, proOwedForAll } from "@/lib/pro-payout";
import { createNotification } from "@/lib/notify";
import { BACKGROUND_CHECK_FEE, bgCheckDeductionFor } from "@/lib/background-check";

export const MIN_CASHOUT = 10;

// 1% instant fee, min $0.50
export function calcInstantFee(amount: number) {
  return Math.max(0.5, amount * 0.01);
}

// GET — available balance
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [unpaid, paid, pendingTips, activeDisputes] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false },
      select: { id: true, totalPrice: true, materialsEstimate: true, completedAt: true, service: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", handymanPaidOut: true },
      select: { id: true, totalPrice: true, materialsEstimate: true, paidOutAt: true, service: { select: { title: true } } },
      orderBy: { paidOutAt: "desc" },
      take: 20,
    }),
    prisma.tip.findMany({
      where: { booking: { handymanId: user.id, handymanPaidOut: false } },
      select: { amount: true },
    }),
    prisma.booking.count({
      where: { handymanId: user.id, status: "DISPUTED" },
    }),
  ]);

  const bookingEarnings = proOwedForAll(unpaid);
  const tipEarnings = pendingTips.reduce((s, t) => s + t.amount, 0);
  const available = bookingEarnings + tipEarnings;

  return NextResponse.json({
    available,
    tipEarnings,
    activeDisputes,
    minCashout: MIN_CASHOUT,
    instantFee: calcInstantFee(available),
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
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false },
    }),
    prisma.booking.count({ where: { handymanId: user.id, status: "DISPUTED" } }),
    prisma.tip.findMany({
      where: { booking: { handymanId: user.id, handymanPaidOut: false } },
      select: { amount: true },
    }),
  ]);

  if (activeDisputes > 0) {
    return NextResponse.json(
      { error: `You have ${activeDisputes} disputed booking${activeDisputes > 1 ? "s" : ""} under review. Payouts are frozen until all disputes are resolved.` },
      { status: 400 }
    );
  }

  if (pending.length === 0) {
    return NextResponse.json({ error: "No earnings available to cash out." }, { status: 400 });
  }

  const tipTotal = pendingTips.reduce((s, t) => s + t.amount, 0);
  // Everything the pro is owed: labour net, materials at cost, and tips.
  // The instant fee is charged on this whole total, per the pricing rule
  // that the pro bears the cost of the amount they choose to move.
  const gross = proOwedForAll(pending) + tipTotal;

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
  await stripe.transfers.create({
    amount: Math.round((gross - bgCheckDeduction) * 100),
    currency: "usd",
    destination: user.stripeAccountId,
    description: `Tarea instant cashout — ${pending.length} job${pending.length > 1 ? "s" : ""}`,
    metadata: { handymanId: user.id },
  });

  // Push net (after fee) from connected account balance → debit card instantly
  await stripe.payouts.create(
    {
      amount: Math.round(net * 100),
      currency: "usd",
      method: "instant",
      description: "Tarea instant cashout",
      metadata: { handymanId: user.id },
    },
    { stripeAccount: user.stripeAccountId }
  );

  const now = new Date();
  await prisma.booking.updateMany({
    where: { id: { in: pending.map(b => b.id) } },
    data: { handymanPaidOut: true, paidOutAt: now },
  });

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
    title: "Instant Payout Sent",
    body: `$${net.toFixed(2)} is on its way to your debit card — arrives within 30 minutes. ($${fee.toFixed(2)} instant fee${bgNote})`,
    type: "payout",
  });

  return NextResponse.json({ success: true, gross, fee, bgCheckDeduction, net, count: pending.length });
}
