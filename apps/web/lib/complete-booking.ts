import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handymanNet } from "@/lib/fees";
import { proOwedFor } from "@/lib/pro-payout";
import { checkPayoutAccount, alertPayoutFailure } from "@/lib/payout-account";
import { sendInvoiceEmail } from "@/lib/email";
import { releaseProxySessions } from "@/lib/voice";

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
        await stripe.transfers.create({
          amount: Math.round(payout * 100),
          currency: "usd",
          destination: handymanUser!.stripeAccountId!,
          transfer_group: booking.id,
        });
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
