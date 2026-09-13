import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/// Payouts that have ALREADY been made, grouped by Stripe transfer.
///
/// /api/admin/payouts answers "who is owed money?". Nothing answered "what did
/// we actually pay, and when?" -- that meant opening Stripe and matching
/// transfers to pros by hand.
///
/// Grouped by transfer because that is the unit that left the bank: one
/// transfer usually settles several bookings, and a flat list of bookings
/// cannot be reconciled against a Stripe statement.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 200), 500);

  const rows = await prisma.booking.findMany({
    where: { handymanPaidOut: true },
    orderBy: [{ payoutAt: "desc" }, { completedAt: "desc" }],
    take: limit,
    select: {
      id: true, totalPrice: true, completedAt: true,
      payoutTransferId: true, payoutAt: true, payoutAmount: true,
      service: { select: { title: true } },
      handyman: { select: { id: true, name: true, email: true } },
    },
  });

  // Anything paid before migration 020 has no transfer id. Those are grouped
  // under a per-pro key and labelled rather than hidden -- they are real
  // payments, just ones made before this was recorded.
  type Row = (typeof rows)[number];
  const groups = new Map<string, {
    transferId: string | null; paidAt: string | null; tracked: boolean;
    handyman: Row["handyman"]; amount: number; bookings: Row[];
  }>();

  for (const b of rows) {
    const key = b.payoutTransferId ?? `untracked:${b.handyman.id}`;
    const g = groups.get(key) ?? {
      transferId: b.payoutTransferId,
      paidAt: b.payoutAt?.toISOString() ?? null,
      tracked: !!b.payoutTransferId,
      handyman: b.handyman,
      amount: 0,
      bookings: [] as Row[],
    };
    g.amount += b.payoutAmount ?? 0;
    g.bookings.push(b);
    groups.set(key, g);
  }

  return NextResponse.json({
    // Array.from rather than spread: the project targets a JS version whose
    // Map iterators are not spreadable without --downlevelIteration.
    transfers: Array.from(groups.values()),
    untrackedCount: rows.filter(b => !b.payoutTransferId).length,
  });
}
