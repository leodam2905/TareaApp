export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { proOwedForAll, payoutIdempotencyKey } from "@/lib/pro-payout";
import { checkPayoutAccount, alertPayoutFailure } from "@/lib/payout-account";
import { createNotification } from "@/lib/notify";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { bgCheckDeductionFor } from "@/lib/background-check";

// Runs every Monday at 9 AM UTC via Vercel cron
// Pays out all remaining unpaid earnings to handyman bank accounts (standard, free)
export async function GET(_req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Group unpaid completed bookings by handyman
  const unpaid = await prisma.booking.findMany({
    where: { status: "COMPLETED", isPaid: true, handymanPaidOut: false },
    include: {
      handyman: {
        select: {
          id: true, name: true, stripeAccountId: true, stripeAccountStatus: true,
          handymanProfile: { select: { backgroundCheckStatus: true } },
        },
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
    const total = proOwedForAll(bookings);
    if (total < 1) { skipped++; continue; }

    // Ask Stripe whether this destination is payable, rather than believing
    // stripeAccountStatus. This cron is the retry for transfers that already
    // failed once, so a silent skip here repeats every Monday forever — which
    // is exactly what a mode-mismatched account used to do.
    const check = await checkPayoutAccount(handyman.stripeAccountId);
    if (!check.ok) {
      await alertPayoutFailure({
        handymanId: handyman.id,
        amount: total,
        reason: check.reason,
        detail: check.detail,
        bookingId: bookings[0]?.id,
      });
      skipped++;
      continue;
    }

    // A deferred background check is recouped from the first payout that can
    // carry it — weekly or instant, whichever comes first. This path used to
    // ignore it entirely, so deferring and waiting for Monday meant never
    // paying at all.
    const bg = bgCheckDeductionFor(
      handyman.handymanProfile?.backgroundCheckStatus,
      total,
    );
    const payable = total - bg.amount;

    const bookingIds = bookings.map(b => b.id);
    try {
      // STEP 1 — transfer, platform → connected account. This is the step that
      // discharges Tarea's obligation: once it lands, the money is the pro's.
      //
      // The deduction is retained by NOT sending it. Transferring the full
      // amount and paying out less would leave the fee sitting in the pro's own
      // Stripe balance, where their next payout hands it straight back.
      await stripe.transfers.create(
        {
          amount: Math.round(payable * 100),
          currency: "usd",
          destination: handyman.stripeAccountId,
          description: `Tarea weekly payout — ${bookings.length} job${bookings.length > 1 ? "s" : ""}`,
          metadata: { handymanId: handyman.id },
        },
        { idempotencyKey: payoutIdempotencyKey(bookingIds, "weekly") },
      );

      // Recorded IMMEDIATELY, before the payout is attempted.
      //
      // These two used to share one try block with the flag written last, so a
      // payout failure — which is routine, the funds may not have cleared into
      // the available balance yet — unwound into the catch with the transfer
      // already done and the bookings still marked unpaid. The following Monday
      // swept the same jobs and transferred a SECOND time. The flag belongs to
      // the transfer, because the transfer is what moved the money.
      await prisma.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { handymanPaidOut: true, paidOutAt: now },
      });

      // Mark the check paid only after the money actually moved. Doing it
      // earlier would drop the charge if the transfer threw.
      if (bg.amount > 0) {
        await prisma.handymanProfile.updateMany({
          where: { userId: handyman.id },
          data: { backgroundCheckStatus: "IN_PROGRESS", backgroundCheckPaidAt: now },
        });
      }

      // STEP 2 — payout, connected account → the pro's bank. Separate and
      // non-fatal on purpose: the pro already has the money in Stripe, and
      // Express accounts are on Stripe's own payout schedule anyway, so a
      // failure here delays the bank arrival rather than losing anything. It
      // must never unwind step 1.
      let payoutSent = true;
      try {
        await stripe.payouts.create(
          {
            amount: Math.round(payable * 100),
            currency: "usd",
            method: "standard",
            description: "Tarea weekly payout",
            metadata: { handymanId: handyman.id },
          },
          {
            stripeAccount: handyman.stripeAccountId,
            idempotencyKey: payoutIdempotencyKey(bookingIds, "weekly-payout"),
          },
        );
      } catch (err) {
        payoutSent = false;
        console.warn(`[weekly-payouts] payout failed for ${handyman.id}:`, err);
      }

      const bgNote = bg.amount > 0
        ? ` (includes a $${bg.amount.toFixed(2)} background check deduction)`
        : "";
      await createNotification({
        userId: handyman.id,
        title: "Weekly Payout Sent",
        body: payoutSent
          ? `$${payable.toFixed(2)} is on its way to your bank account. It arrives in 1–2 business days.${bgNote}`
          : `$${payable.toFixed(2)} has been added to your Tarea balance.${bgNote} It will reach your bank on your next scheduled payout.`,
        type: "payout",
      });

      paid++;
    } catch (err) {
      await alertPayoutFailure({
        handymanId: handyman.id,
        amount: total,
        reason: "transfer_failed",
        detail: err instanceof Error ? err.message : String(err),
        bookingId: bookings[0]?.id,
      });
      skipped++;
    }
  }

  return NextResponse.json({ paid, skipped, timestamp: now.toISOString() });
}
