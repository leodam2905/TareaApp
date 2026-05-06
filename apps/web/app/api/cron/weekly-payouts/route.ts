export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { createNotification } from "@/lib/notify";
import { headers } from "next/headers";

// Runs every Monday at 9 AM UTC via Vercel cron
// Pays out all remaining unpaid earnings to handyman bank accounts (standard, free)
export async function GET(_req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = headers().get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Group unpaid completed bookings by handyman
  const unpaid = await prisma.booking.findMany({
    where: { status: "COMPLETED", isPaid: true, handymanPaidOut: false },
    include: {
      handyman: {
        select: { id: true, name: true, stripeAccountId: true, stripeAccountStatus: true },
      },
    },
  });

  const byHandyman = new Map<string, { handyman: typeof unpaid[0]["handyman"]; bookings: typeof unpaid }>();
  for (const b of unpaid) {
    const key = b.handymanId;
    if (!byHandyman.has(key)) byHandyman.set(key, { handyman: b.handyman, bookings: [] });
    byHandyman.get(key)!.bookings.push(b);
  }

  let paid = 0;
  let skipped = 0;
  const now = new Date();

  for (const { handyman, bookings } of byHandyman.values()) {
    // Skip handymen without an active Stripe account
    if (!handyman.stripeAccountId || handyman.stripeAccountStatus !== "active") {
      skipped++;
      continue;
    }

    const total = bookings.reduce((s, b) => s + handymanNet(b.totalPrice), 0);
    if (total < 1) { skipped++; continue; }

    try {
      // Transfer from platform → connected account
      await stripe.transfers.create({
        amount: Math.round(total * 100),
        currency: "usd",
        destination: handyman.stripeAccountId,
        description: `Tarea weekly payout — ${bookings.length} job${bookings.length > 1 ? "s" : ""}`,
        metadata: { handymanId: handyman.id },
      });

      // Standard payout from connected account → bank account (free, 1–2 days)
      await stripe.payouts.create(
        {
          amount: Math.round(total * 100),
          currency: "usd",
          method: "standard",
          description: "Tarea weekly payout",
          metadata: { handymanId: handyman.id },
        },
        { stripeAccount: handyman.stripeAccountId }
      );

      await prisma.booking.updateMany({
        where: { id: { in: bookings.map(b => b.id) } },
        data: { handymanPaidOut: true, paidOutAt: now },
      });

      await createNotification({
        userId: handyman.id,
        title: "Weekly Payout Sent",
        body: `$${total.toFixed(2)} is on its way to your bank account. It arrives in 1–2 business days.`,
        type: "payout",
      });

      paid++;
    } catch (err) {
      console.error(`[weekly-payouts] Failed for handyman ${handyman.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ paid, skipped, timestamp: now.toISOString() });
}
