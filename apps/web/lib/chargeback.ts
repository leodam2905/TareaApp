import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

/**
 * Card-network chargebacks and the payout hold they trigger.
 *
 * Tarea is merchant of record with separate charges and transfers, so a
 * chargeback pulls funds from the PLATFORM balance — not from the pro, who has
 * usually been paid weeks earlier. Nothing in the product used to know a
 * dispute existed, so no payout path could decline to pay. These helpers set
 * `booking.payoutHold`, which every payout query now tests.
 *
 * Deliberately separate from the in-app dispute fields (disputeReason /
 * disputedBy / disputedAt): those are a customer complaint raised in the app,
 * these are the network taking money back. Both can be open at once.
 */

async function alertAdmins(title: string, body: string, refId?: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    await Promise.allSettled(
      admins.map((a) =>
        createNotification({ userId: a.id, title, body, type: "payout", refId }),
      ),
    );
  } catch (err) {
    // Alerting must never break webhook processing: Stripe would retry the
    // event and we would re-apply the hold, but the money question is settled
    // by the DB write above, not by whether a notification was delivered.
    console.error("[chargeback] alerting failed:", err);
  }
}

/**
 * Resolve the booking behind a dispute or fraud warning.
 *
 * `payment_intent` is usually present, but on older charges and some card
 * networks only `charge` is, so fall back to retrieving the charge. Returns
 * null rather than throwing — an unmatched dispute must still be alerted on,
 * and Stripe events also cover charges that are not bookings at all
 * (background checks, subscriptions, tips).
 */
export async function bookingForCharge(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
  charge: string | Stripe.Charge | null | undefined,
) {
  let piId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null;

  if (!piId && charge) {
    const chargeId = typeof charge === "string" ? charge : charge.id;
    try {
      const c = await stripe.charges.retrieve(chargeId);
      piId = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id ?? null;
    } catch (err) {
      console.warn("[chargeback] could not resolve charge", chargeId, err);
    }
  }
  if (!piId) return null;

  return prisma.booking.findFirst({
    where: { stripePaymentIntentId: piId },
    select: { id: true, handymanId: true, customerId: true, totalPrice: true, handymanPaidOut: true },
  });
}

/** A dispute was opened. Freeze payout and tell the admins — evidence is due. */
export async function onDisputeOpened(dispute: Stripe.Dispute) {
  const booking = await bookingForCharge(dispute.payment_intent, dispute.charge);
  const amount = (dispute.amount ?? 0) / 100;
  const due = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10)
    : "unknown";

  if (booking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        chargebackStatus: dispute.status,
        chargebackReason: dispute.reason,
        chargebackAmount: amount,
        chargebackAt: new Date(),
        payoutHold: true,
      },
    });
  }

  // Worth saying explicitly in the alert: once the pro has been paid, holding
  // future payouts no longer protects this particular amount.
  const paid = booking?.handymanPaidOut
    ? " The pro has ALREADY been paid for this job, so the loss falls on the platform."
    : " Payout for this job is now on hold.";

  await alertAdmins(
    `Chargeback opened — $${amount.toFixed(2)}`,
    `Reason: ${dispute.reason}. Evidence due ${due}.${
      booking ? `` : ` No booking matched this charge (${dispute.charge}).`
    }${booking ? paid : ""}`,
    booking?.id,
  );
}

/** Dispute resolved. Release the hold only if we actually won. */
export async function onDisputeClosed(dispute: Stripe.Dispute) {
  const booking = await bookingForCharge(dispute.payment_intent, dispute.charge);
  const won = dispute.status === "won" || dispute.status === "warning_closed";

  if (booking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        chargebackStatus: dispute.status,
        // A lost dispute keeps the hold: the money is gone and the pro must not
        // be paid from it. Releasing that is an admin decision, not automatic.
        ...(won ? { payoutHold: false } : {}),
      },
    });
  }

  await alertAdmins(
    won ? "Chargeback won" : `Chargeback ${dispute.status}`,
    won
      ? `Dispute closed in our favour. Payout hold released.`
      : `Dispute closed as "${dispute.status}". The payout stays on hold — release it manually if the pro should still be paid.`,
    booking?.id,
  );
}

/**
 * Early fraud warning: the issuer has flagged the charge as fraudulent but no
 * chargeback exists yet. Refunding now usually prevents the dispute entirely,
 * and a dispute that never happens never counts against the account's dispute
 * rate — which is the number Stripe reviews merchants on. So this is the
 * cheapest possible intervention, and it is time-limited.
 */
export async function onEarlyFraudWarning(efw: Stripe.Radar.EarlyFraudWarning) {
  const booking = await bookingForCharge(efw.payment_intent, efw.charge);

  if (booking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { fraudWarningAt: new Date(), payoutHold: true },
    });
  }

  await alertAdmins(
    "Early fraud warning — refund to avoid a chargeback",
    `Issuer flagged this charge as ${efw.fraud_type}. Refunding now normally prevents a dispute, which keeps it off the account's dispute rate.${
      booking ? " Payout is on hold." : ` No booking matched charge ${efw.charge}.`
    }`,
    booking?.id,
  );
}
