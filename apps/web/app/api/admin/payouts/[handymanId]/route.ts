import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { proOwedFor, proOwedForAll, payoutIdempotencyKey } from "@/lib/pro-payout";

// POST — trigger payout for all pending bookings for this handyman
export async function POST(_req: NextRequest, { params }: { params: { handymanId: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const handyman = await prisma.user.findUnique({ where: { id: params.handymanId } });
  if (!handyman?.stripeAccountId || handyman.stripeAccountStatus !== "active") {
    return NextResponse.json({ error: "Handyman does not have an active Stripe account" }, { status: 400 });
  }

  const pending = await prisma.booking.findMany({
    where: { handymanId: params.handymanId, status: "COMPLETED", isPaid: true, handymanPaidOut: false, payoutHold: false },
  });

  if (pending.length === 0) return NextResponse.json({ message: "No pending payouts", count: 0 });

  const totalAmount = proOwedForAll(pending);

  const payoutIds = pending.map(b => b.id);

  // This button is clicked by a human, and a double click used to mean a second
  // transfer. The other payout paths -- weekly cron, instant cashout, booking
  // completion -- have always keyed these; this one was missed. Stripe returns
  // the FIRST transfer for a repeated key rather than making another.
  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      destination: handyman.stripeAccountId,
      description: `Payout for ${pending.length} completed bookings`,
    },
    { idempotencyKey: payoutIdempotencyKey(payoutIds, "admin") },
  );

  // Record WHICH transfer paid each booking. One transfer covers several, so
  // each row keeps its own share -- the transfer itself only carries the total,
  // and without the split it cannot be attributed back to the jobs it settled.
  const paidAt = new Date();
  await prisma.$transaction(
    pending.map(b =>
      prisma.booking.update({
        where: { id: b.id },
        data: {
          handymanPaidOut: true,
          payoutTransferId: transfer.id,
          payoutAt: paidAt,
          payoutAmount: proOwedFor(b),
        },
      }),
    ),
  );

  return NextResponse.json({
    message: "Payout sent",
    count: pending.length,
    amount: totalAmount,
    transferId: transfer.id,
  });
}
