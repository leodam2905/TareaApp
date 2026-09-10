import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { proOwedFor, materialsRefundDue, payoutIdempotencyKey } from "@/lib/pro-payout";
import { checkPayoutAccount, alertPayoutFailure, alertRefundFailure } from "@/lib/payout-account";
import { sendInvoiceEmail } from "@/lib/email";
import { releaseProxySessions } from "@/lib/voice";
import { createNotification } from "@/lib/notify";

// Completes a paid, in-progress booking and releases escrow to the pro. Used by
// both the customer's "Confirm completion" (bookings PATCH) and the 3-day
// auto-release cron. Payout = labor net (minus the pro's fee) + FULL materials
// at cost (pass-through — the pro already bought the parts).
export async function completeBooking(bookingId: string, opts?: { receiptUrl?: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { title: true, category: true } },
      customer: { select: { email: true, name: true } },
      handyman: { select: { name: true } },
    },
  });
  if (!booking || booking.status === "COMPLETED") return booking;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...(opts?.receiptUrl ? { receiptUrl: opts.receiptUrl, receiptUploadedAt: new Date() } : {}),
    },
  });

  // Labor earnings (materials are reimbursement, not earnings).
  await prisma.handymanProfile.updateMany({
    where: { userId: booking.handymanId },
    data: { totalEarnings: { increment: handymanNet(booking.totalPrice) } },
  });

  // Refund the materials the pro did not spend.
  //
  // Materials are prepaid from the estimate given at application and reimbursed
  // at cost capped at that estimate, so an underspend is the customer's money.
  // Refunded BEFORE the transfer, so the platform balance still holds the funds
  // — and recorded, so a retry after a Stripe failure cannot refund twice. No
  // service fee is charged on materials, so the difference is refunded whole.
  if (booking.isPaid && booking.stripePaymentIntentId && booking.materialsRefunded == null) {
    const due = materialsRefundDue(booking);
    if (due > 0) {
      try {
        // Ask Stripe what it has already given back before giving back more.
        //
        // booking.materialsRefunded guards against OUR retries, but it knows
        // nothing about a refund an admin issued by hand in the Stripe
        // dashboard — which is exactly what the failure alert below tells them
        // to do. Without this, a hand-refunded job that later completed would
        // pay the customer twice.
        const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId, {
          expand: ["latest_charge"],
        });
        const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge;
        const alreadyRefunded = (charge?.amount_refunded ?? 0) / 100;

        if (alreadyRefunded >= due) {
          // Someone already refunded at least what was owed. Record it so this
          // stops asking, and say nothing to the customer — they have the money.
          await prisma.booking.update({
            where: { id: bookingId },
            data: { materialsRefunded: alreadyRefunded },
          });
          console.warn(
            `[completeBooking] materials already refunded ($${alreadyRefunded.toFixed(2)}) for ${bookingId} — recorded, not re-refunded`,
          );
        } else {
          const outstanding = Math.round((due - alreadyRefunded) * 100) / 100;
          await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            amount: Math.round(outstanding * 100),
            metadata: { reason: "materials_underspend", bookingId },
          });
          await prisma.booking.update({
            where: { id: bookingId },
            data: { materialsRefunded: due },
          });
          await createNotification({
            userId: booking.customerId,
            title: `Materials refund — $${outstanding.toFixed(2)}`,
            body: `Your pro spent less on materials than quoted for "${booking.service.title}". $${outstanding.toFixed(2)} is on its way back to your card, usually within 5-10 days.`,
            type: "booking_accepted",
            refId: bookingId,
          });
        }
      } catch (err) {
        // A failed refund must not block completion or the pro's payout — the
        // customer is owed money either way. But it must not pass silently:
        // materialsRefunded stays null, so nothing retries on its own and the
        // customer would simply never be paid back.
        await alertRefundFailure({
          bookingId,
          customerId: booking.customerId,
          amount: due,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Invoice email — sent AFTER the refund, not before.
  //
  // It used to go out first, quoting materialsEstimate, so a customer whose pro
  // spent less than quoted received an invoice for money that was already on
  // its way back to their card. The email is the document they keep; it has to
  // match the charge.
  try {
    const refunded = (await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { materialsRefunded: true },
    }))?.materialsRefunded ?? 0;

    await sendInvoiceEmail({
      to: booking.customer.email,
      bookingId: booking.id,
      serviceTitle: booking.service.title,
      serviceCategory: booking.service.category,
      handymanName: booking.handyman.name,
      scheduledAt: booking.scheduledAt,
      address: booking.address,
      city: booking.city,
      totalPrice: booking.totalPrice,
      materials: booking.materialsEstimate ?? 0,
      materialsRefunded: refunded,
    });
  } catch (err) {
    console.error("[completeBooking] invoice email failed:", err);
  }

  // Close the job request this booking came from.
  //
  // The request went ASSIGNED when the pro was hired and stayed there for ever:
  // a customer who had the work done, paid for it and reviewed it still saw the
  // request sitting open in their list, with no way to tell it apart from one
  // nobody had taken. CLOSED is the terminal state the schema already defines.
  //
  // Directed bookings have no jobRequestId and skip this entirely.
  if (booking.jobRequestId) {
    await prisma.jobRequest
      .update({ where: { id: booking.jobRequestId }, data: { status: "CLOSED" } })
      .catch((err) => console.error("[completeBooking] could not close job request:", err));
  }


  // Release escrow: labor net + full materials.
  //
  // The destination is verified against Stripe rather than against
  // stripeAccountStatus, which claimed "active" for accounts the live key could
  // not even see. A payout that cannot happen is now reported, not swallowed.
  const handymanUser = await prisma.user.findUnique({ where: { id: booking.handymanId } });
  if (booking.isPaid && !booking.handymanPaidOut) {
    const payout = proOwedFor(booking);
    // A chargeback or early fraud warning on this job freezes its payout. The
    // job still completes — the work happened — but the money stays put until
    // the dispute resolves, because as merchant of record we cannot claw it
    // back from the pro afterwards.
    const held = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { payoutHold: true },
    });
    if (held?.payoutHold) {
      console.warn("[completeBooking] payout held (chargeback/fraud warning):", bookingId);
      await alertPayoutFailure({
        handymanId: booking.handymanId,
        amount: payout,
        reason: "transfer_failed",
        detail: "Payout held: a chargeback or early fraud warning is open on this booking.",
        bookingId,
      });
      return prisma.booking.findUnique({ where: { id: bookingId } });
    }

    const check = await checkPayoutAccount(handymanUser?.stripeAccountId);

    if (!check.ok) {
      await alertPayoutFailure({
        handymanId: booking.handymanId,
        amount: payout,
        reason: check.reason,
        detail: check.detail,
        bookingId,
      });
    } else {
      try {
        // source_transaction ties the payout to the charge that funded it.
        //
        // Without it a transfer draws the platform's AVAILABLE balance, and a
        // card charge sits in PENDING for about two business days — so a job
        // completed the same day it was paid failed its payout with
        // balance_insufficient and waited for the weekly cron. With it, Stripe
        // accepts the transfer immediately and releases it when the charge
        // settles: the pro sees the money owed to them straight away instead of
        // nothing at all.
        //
        // The charge id is looked up rather than stored — completeBooking
        // already talks to Stripe here, and a nullable column would be one more
        // thing to keep in sync. If the lookup fails the transfer still goes
        // ahead against the platform balance, which is the previous behaviour.
        let sourceTransaction: string | undefined;
        if (booking.stripePaymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
            const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
            if (charge) sourceTransaction = charge;
          } catch (err) {
            console.warn("[completeBooking] could not resolve charge for source_transaction:", err);
          }
        }

        // Keyed on the booking so a retried completion — a duplicated webhook,
        // a crash between this line and the flag below — returns the original
        // transfer instead of sending the pro's money a second time.
        await stripe.transfers.create(
          {
            amount: Math.round(payout * 100),
            currency: "usd",
            destination: check.accountId,
            transfer_group: booking.id,
            ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
          },
          { idempotencyKey: payoutIdempotencyKey([booking.id], "completion") },
        );
        await prisma.booking.update({
          where: { id: bookingId },
          data: { handymanPaidOut: true, paidOutAt: new Date() },
        });
      } catch (err) {
        await alertPayoutFailure({
          handymanId: booking.handymanId,
          amount: payout,
          reason: "transfer_failed",
          detail: err instanceof Error ? err.message : String(err),
          bookingId,
        });
      }
    }
  }

  // The job is over — free the proxy number so it can serve another booking.
  // Covers both the customer's confirmation and the 3-day auto-release cron.
  await releaseProxySessions(bookingId);

  return booking;
}
