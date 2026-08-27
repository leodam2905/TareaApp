import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { proOwedFor } from "@/lib/pro-payout";

// Reconciles three numbers that are never equal and are each kept somewhere
// different:
//
//   1. what the customer was charged      — Stripe payment intent
//   2. what Stripe actually paid us       — charge minus its fee (balance txn)
//   3. what we owe / have paid the pro    — our own booking rows and transfers
//
// The fee lives ONLY in Stripe: nothing in the database records it, so a report
// built from bookings alone reports revenue Tarea never received. Materials are
// the case that matters — they pass through at cost with no commission, but
// Stripe still charges ~2.9% on them, and that comes out of Tarea's margin on
// the labour.
export interface BookingLedgerRow {
  bookingId: string;
  customerCharged: number;
  stripeFee: number;
  netReceived: number;
  proOwed: number;
  proPaid: number;
  tareaKeeps: number;
  paidOut: boolean;
}

export async function reconcile(opts: { since?: Date } = {}) {
  const bookings = await prisma.booking.findMany({
    where: {
      isPaid: true,
      stripePaymentIntentId: { not: null },
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    },
    select: {
      id: true, totalPrice: true, materialsEstimate: true,
      handymanPaidOut: true, stripePaymentIntentId: true, status: true,
    },
  });

  const rows: BookingLedgerRow[] = [];
  for (const b of bookings) {
    let customerCharged = 0, stripeFee = 0, netReceived = 0;
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripePaymentIntentId!, {
        expand: ["latest_charge.balance_transaction"],
      });
      customerCharged = (pi.amount_received ?? 0) / 100;
      const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge;
      const txn = charge && typeof charge.balance_transaction !== "string"
        ? charge.balance_transaction
        : null;
      if (txn) {
        stripeFee = txn.fee / 100;
        netReceived = txn.net / 100;
      }
    } catch {
      // A lookup failure leaves zeros rather than inventing numbers — an
      // unreconciled row is information, a fabricated one is not.
    }

    const transfers = await stripe.transfers.list({ transfer_group: b.id, limit: 10 });
    const proPaid = transfers.data
      .filter((t) => !t.reversed)
      .reduce((s, t) => s + t.amount, 0) / 100;

    rows.push({
      bookingId: b.id,
      customerCharged,
      stripeFee,
      netReceived,
      proOwed: proOwedFor(b),
      proPaid,
      tareaKeeps: Math.round((netReceived - proPaid) * 100) / 100,
      paidOut: b.handymanPaidOut,
    });
  }

  const sum = (fn: (r: BookingLedgerRow) => number) =>
    Math.round(rows.reduce((t, r) => t + fn(r), 0) * 100) / 100;

  return {
    rows,
    totals: {
      customerCharged: sum((r) => r.customerCharged),
      stripeFees: sum((r) => r.stripeFee),
      netReceived: sum((r) => r.netReceived),
      proOwed: sum((r) => r.proOwed),
      proPaid: sum((r) => r.proPaid),
      tareaKeeps: sum((r) => r.tareaKeeps),
      // Completed work not yet transferred — the liability side.
      outstandingToPros: sum((r) => (r.paidOut ? 0 : r.proOwed)),
    },
  };
}
