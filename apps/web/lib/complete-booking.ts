import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { proOwedFor, materialsRefundDue, payoutIdempotencyKey } from "@/lib/pro-payout";
import { checkPayoutAccount, alertPayoutFailure } from "@/lib/payout-account";
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

  try {
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
    });
  } catch (err) {
    console.error("[completeBooking] invoice email failed:", err);
  }
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
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: Math.round(due * 100),
          metadata: { reason: "materials_underspend", bookingId },
        });
        await prisma.booking.update({ where: { id: bookingId }, data: { materialsRefunded: due } });
        await createNotification({
          userId: booking.customerId,
          title: `Materials refund — $${due.toFixed(2)}`,
          body: `Your pro spent less on materials than quoted for "${booking.service.title}". $${due.toFixed(2)} is on its way back to your card, usually within 5-10 days.`,
          type: "booking_accepted",
          refId: bookingId,
        });
      } catch (err) {
        // A failed refund must not block completion or the pro's payout — the
        // customer is owed money either way, and an admin can see it unrefunded.
        console.error("[completeBooking] materials refund failed:", err);
      }
    }
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
            destination: handymanUser!.stripeAccountId!,
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
