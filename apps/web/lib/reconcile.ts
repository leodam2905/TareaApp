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
  /** Given back to the customer — today, materials they were quoted but the pro
   *  did not spend. Stripe does NOT return its fee on a refund, so this reduces
   *  what Tarea keeps by the full amount and the fee stays paid. */
  refunded: number;
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
      id: true, totalPrice: true, materialsEstimate: true, materialsActual: true, materialsRefunded: true,
      handymanPaidOut: true, stripePaymentIntentId: true, status: true,
    },
  });

  const rows: BookingLedgerRow[] = [];
  for (const b of bookings) {
    let customerCharged = 0, refunded = 0, stripeFee = 0, netReceived = 0;
    try {
      const pi = await stripe.paymentIntents.retrieve(b.stripePaymentIntentId!, {
        expand: ["latest_charge.balance_transaction"],
      });
      customerCharged = (pi.amount_received ?? 0) / 100;
      const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge;
      // From Stripe, not from booking.materialsRefunded: the DB records what we
      // asked for, this records what actually left the account.
      refunded = (charge?.amount_refunded ?? 0) / 100;
      const txn = charge && typeof charge.balance_transaction !== "string"
        ? charge.balance_transaction
        : null;
      if (txn) {
        stripeFee = txn.fee / 100;
        netReceived = (txn.net - (charge?.amount_refunded ?? 0)) / 100;
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
      refunded,
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

  // Stripe Climate contributions.
  //
  // These do NOT appear in a charge's fee or net — they are separate balance
  // transactions, debited from the platform balance after the fact. So a report
  // built from payment intents alone reports a margin Tarea does not have, and
  // by a fixed percentage of every charge: on the first live booking it was the
  // difference between the $10.53 this file computed and the $9.95 actually
  // sitting in the balance.
  //
  // Summed for the period rather than attributed per booking. Stripe does not
  // link the contribution back to the charge in a way that survives partial
  // refunds, and inventing an attribution would make the per-row numbers look
  // more precise than they are.
  let climateContributions = 0;
  try {
    const since = opts.since ? Math.floor(opts.since.getTime() / 1000) : undefined;
    for await (const txn of stripe.balanceTransactions.list({
      // Not in the SDK's union in every version; the API accepts it.
      type: "climate_order_purchase" as never,
      ...(since ? { created: { gte: since } } : {}),
      limit: 100,
    })) {
      // Debits arrive negative — count them as a positive cost.
      climateContributions += Math.abs(txn.amount);
    }
    climateContributions = Math.round(climateContributions) / 100;
  } catch (err) {
    // Never block the report on it; a zero here is visibly different from a
    // wrong total, and the caller can see the warning.
    console.warn("[reconcile] climate contribution lookup failed:", err);
  }

  return {
    rows,
    totals: {
      customerCharged: sum((r) => r.customerCharged),
      refunded: sum((r) => r.refunded),
      stripeFees: sum((r) => r.stripeFee),
      netReceived: sum((r) => r.netReceived),
      proOwed: sum((r) => r.proOwed),
      proPaid: sum((r) => r.proPaid),
      tareaKeeps: sum((r) => r.tareaKeeps),
      // What Stripe Climate took out of that margin over the period.
      climateContributions,
      // The number that should match the platform balance.
      tareaKeepsNet: Math.round((sum((r) => r.tareaKeeps) - climateContributions) * 100) / 100,
      // Completed work not yet transferred — the liability side.
      outstandingToPros: sum((r) => (r.paidOut ? 0 : r.proOwed)),
    },
  };
}
