export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { proOwedForAll, payoutIdempotencyKey, unpaidTipsWhere, tipTotal } from "@/lib/pro-payout";
import { checkPayoutAccount, alertPayoutFailure } from "@/lib/payout-account";
import { createNotification } from "@/lib/notify";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { bgCheckDeductionFor } from "@/lib/background-check";

// Scheduled by Cloud Scheduler, not by the crons block in vercel.json — that
// file is read only by Vercel and this deploys to Cloud Run. The live schedule
// is Monday and Thursday at 09:00 America/New_York; the route is safe to run at
// any cadence because it only ever picks up bookings still marked unpaid.
//
// Pays out remaining unpaid earnings to handyman bank accounts (standard, free).
// Connected accounts also stay on Stripe's own automatic weekly payout, so a
// failure here delays money rather than stranding it.
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

  // Tips are swept here too, and this — not instant cashout — is the path that
  // has to work. A customer may only tip a booking that is COMPLETED and paid,
  // and completeBooking() transfers the pro's money and sets handymanPaidOut at
  // the moment of completion. So a tip is essentially never attached to a
  // booking still flagged unpaid, which is exactly what the old tip query
  // required. Nothing here transferred tips at all, and this cron SET that flag
  // — permanently hiding any tip that had squeezed through.
  //
  // A tip now carries its own paidOutAt (migration 018) and is asked directly.
  const unpaidTips = await prisma.tip.findMany({
    where: unpaidTipsWhere(),
    select: {
      id: true,
      amount: true,
      booking: {
        select: {
          handymanId: true,
          handyman: {
        select: {
          id: true, name: true, stripeAccountId: true, stripeAccountStatus: true,
          handymanProfile: { select: { backgroundCheckStatus: true } },
        },
          },
        },
      },
    },
  });

  type Slot = {
    handyman: typeof unpaid[0]["handyman"];
    bookings: typeof unpaid;
    tips: typeof unpaidTips;
  };
  const byHandyman = new Map<string, Slot>();
  const slotFor = (key: string, handyman: Slot["handyman"]): Slot => {
    if (!byHandyman.has(key)) byHandyman.set(key, { handyman, bookings: [], tips: [] });
    return byHandyman.get(key)!;
  };
  for (const b of unpaid) {
    slotFor(b.handymanId, b.handyman).bookings.push(b);
  }
  // Keyed off the tips as well, or a pro whose only outstanding money is tips —
  // every job already paid out at completion — is never visited at all.
  for (const t of unpaidTips) {
    slotFor(t.booking.handymanId, t.booking.handyman).tips.push(t);
  }

  let paid = 0;
  let skipped = 0;
  const now = new Date();

  // Array.from, not the iterator directly: this tsconfig has no
  // downlevelIteration, so iterating the Map made every destructured binding
  // implicitly `any` — which silently switched off type checking for the whole
  // payout loop, the last place that should be unchecked.
  for (const { handyman, bookings, tips } of Array.from(byHandyman.values())) {
    // Tips ride in the same transfer but carry no commission — 100% of a tip is
    // the pro's, so it is added to the payout, never to the fee base.
    const total = Math.round((proOwedForAll(bookings) + tipTotal(tips)) * 100) / 100;
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
    const tipIds = tips.map(t => t.id);
    // Prefixed so a tip id cannot collide with a booking id, and included so a
    // tips-only payout does not hash the empty set — which would give every
    // such payout the same key and make Stripe replay the first transfer.
    const payoutIds = [...bookingIds, ...tipIds.map(id => `tip:${id}`)];
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
          destination: check.accountId,
          description: bookings.length > 0
            ? `Tarea payout — ${bookings.length} job${bookings.length > 1 ? "s" : ""}`
            : `Tarea payout — ${tips.length} tip${tips.length > 1 ? "s" : ""}`,
          metadata: { handymanId: handyman.id },
        },
        { idempotencyKey: payoutIdempotencyKey(payoutIds, "weekly") },
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
      // Marked on the same terms as the bookings, and for the same reason: the
      // transfer has already moved this money.
      if (tipIds.length > 0) {
        await prisma.tip.updateMany({ where: { id: { in: tipIds } }, data: { paidOutAt: now } });
      }

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
            description: "Tarea payout",
            metadata: { handymanId: handyman.id },
          },
          {
            stripeAccount: check.accountId,
            idempotencyKey: payoutIdempotencyKey(payoutIds, "weekly-payout"),
          },
        );
      } catch (err) {
        payoutSent = false;
        console.warn(`[weekly-payouts] payout failed for ${handyman.id}:`, err);
      }

      const bgNote = bg.amount > 0
        ? ` (includes a $${bg.amount.toFixed(2)} background check deduction)`
        : "";
      // Named explicitly: a pro who was tipped weeks ago and is only now seeing
      // the money should be able to tell what this payment is.
      const tipNote = tips.length > 0
        ? ` Includes $${tipTotal(tips).toFixed(2)} in tips — tips are yours in full.`
        : "";
      await createNotification({
        userId: handyman.id,
        title: "Payout Sent",
        body: payoutSent
          ? `$${payable.toFixed(2)} is on its way to your bank account. It arrives in 1–2 business days.${bgNote}${tipNote}`
          : `$${payable.toFixed(2)} has been added to your Tarea balance.${bgNote} It will reach your bank on your next scheduled payout.${tipNote}`,
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
