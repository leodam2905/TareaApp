import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { createNotification } from "@/lib/notify";

export const MIN_CASHOUT = 10;

// 1% instant fee, min $0.50
export function calcInstantFee(amount: number) {
  return Math.max(0.5, amount * 0.01);
}

// GET — available balance
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [unpaid, paid] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false },
      select: { id: true, totalPrice: true, completedAt: true, service: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", handymanPaidOut: true },
      select: { id: true, totalPrice: true, paidOutAt: true, service: { select: { title: true } } },
      orderBy: { paidOutAt: "desc" },
      take: 20,
    }),
  ]);

  const available = unpaid.reduce((s, b) => s + handymanNet(b.totalPrice), 0);

  return NextResponse.json({
    available,
    minCashout: MIN_CASHOUT,
    instantFee: calcInstantFee(available),
    stripeStatus: user.stripeAccountStatus ?? "not_connected",
    pendingBookings: unpaid.map(b => ({
      id: b.id,
      service: b.service.title,
      net: handymanNet(b.totalPrice),
      completedAt: b.completedAt,
    })),
    payoutHistory: paid.map(b => ({
      id: b.id,
      service: b.service.title,
      net: handymanNet(b.totalPrice),
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

  const pending = await prisma.booking.findMany({
    where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false },
  });

  if (pending.length === 0) {
    return NextResponse.json({ error: "No earnings available to cash out." }, { status: 400 });
  }

  const gross = pending.reduce((s, b) => s + handymanNet(b.totalPrice), 0);

  if (gross < MIN_CASHOUT) {
    return NextResponse.json(
      { error: `Minimum cashout is $${MIN_CASHOUT}. You have $${gross.toFixed(2)} available.` },
      { status: 400 }
    );
  }

  const fee = calcInstantFee(gross);
  const net = gross - fee;

  // Move gross from platform → connected account
  await stripe.transfers.create({
    amount: Math.round(gross * 100),
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

  await createNotification({
    userId: user.id,
    title: "Instant Payout Sent",
    body: `$${net.toFixed(2)} is on its way to your debit card — arrives within 30 minutes. ($${fee.toFixed(2)} instant fee)`,
    type: "payout",
  });

  return NextResponse.json({ success: true, gross, fee, net, count: pending.length });
}
