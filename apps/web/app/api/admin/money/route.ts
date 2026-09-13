import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { proOwedFor } from "@/lib/pro-payout";

/// Both sides of the money for each booking, on one row.
///
/// Until now "where did this customer's money go?" meant reading
/// /admin/bookings for the charge, Stripe for the transfer, and holding the fee
/// arithmetic in your head. The numbers existed; nothing put them side by side.
///
/// `feeRetained` is DERIVED (charged minus the pro's share) rather than stored,
/// so it cannot drift from CUSTOMER_FEE_RATE the way the hard-coded 0.90 in the
/// late-cancel path once did.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, createdAt: true, status: true, totalPrice: true,
      isPaid: true, capturedAmount: true, authorizedAmount: true,
      stripePaymentIntentId: true,
      handymanPaidOut: true, payoutTransferId: true, payoutAt: true, payoutAmount: true,
      payoutHold: true, chargebackStatus: true,
      materialsEstimate: true, materialsActual: true, materialsRefunded: true,
      service: { select: { title: true } },
      customer: { select: { id: true, name: true } },
      handyman: { select: { id: true, name: true } },
      tips: { select: { amount: true, paidOutAt: true } },
    },
  });

  const rows = bookings.map(b => {
    const chargedIn = b.capturedAmount ?? (b.isPaid ? b.totalPrice : 0);
    // What the pro is due for this job, whether or not it has been sent yet.
    const proShare = proOwedFor(b as Parameters<typeof proOwedFor>[0]);
    const tipsTotal = b.tips.reduce((s, t) => s + t.amount, 0);
    const tipsUnpaid = b.tips.filter(t => !t.paidOutAt).reduce((s, t) => s + t.amount, 0);
    return {
      id: b.id,
      createdAt: b.createdAt,
      status: b.status,
      service: b.service?.title ?? null,
      customer: b.customer,
      handyman: b.handyman,
      in: {
        charged: chargedIn,
        isPaid: b.isPaid,
        paymentIntent: b.stripePaymentIntentId,
      },
      out: {
        proShare,
        paid: b.handymanPaidOut,
        amount: b.payoutAmount,
        at: b.payoutAt,
        transferId: b.payoutTransferId,
        onHold: b.payoutHold,
      },
      tips: { total: tipsTotal, unpaid: tipsUnpaid },
      // Derived, never stored: see the note above.
      feeRetained: Math.max(0, chargedIn - proShare),
      chargeback: b.chargebackStatus,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      chargedIn: acc.chargedIn + r.in.charged,
      paidOut: acc.paidOut + (r.out.amount ?? 0),
      feeRetained: acc.feeRetained + r.feeRetained,
      owedOut: acc.owedOut + (r.out.paid ? 0 : r.out.proShare),
    }),
    { chargedIn: 0, paidOut: 0, feeRetained: 0, owedOut: 0 },
  );

  return NextResponse.json({ rows, totals });
}
