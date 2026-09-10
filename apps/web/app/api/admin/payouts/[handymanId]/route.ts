import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { proOwedForAll } from "@/lib/pro-payout";

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

  await stripe.transfers.create({
    amount: Math.round(totalAmount * 100),
    currency: "usd",
    destination: handyman.stripeAccountId,
    description: `Payout for ${pending.length} completed bookings`,
  });

  await prisma.booking.updateMany({
    where: { id: { in: pending.map(b => b.id) } },
    data: { handymanPaidOut: true },
  });

  return NextResponse.json({ message: "Payout sent", count: pending.length, amount: totalAmount });
}
