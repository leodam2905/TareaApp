import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { handymanNet } from "@/lib/fees";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Completed, paid, not yet paid out to handyman
  const pending = await prisma.booking.findMany({
    where: { status: "COMPLETED", isPaid: true, handymanPaidOut: false, payoutHold: false },
    include: {
      handyman: {
        select: {
          id: true, name: true, email: true,
          stripeAccountId: true, stripeAccountStatus: true,
        },
      },
      service: { select: { title: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  // Group by handyman
  const byHandyman = new Map<string, {
    handyman: typeof pending[0]["handyman"];
    bookings: typeof pending;
    totalOwed: number;
    canAutoPay: boolean;
  }>();

  for (const b of pending) {
    const key = b.handymanId;
    if (!byHandyman.has(key)) {
      byHandyman.set(key, {
        handyman: b.handyman,
        bookings: [],
        totalOwed: 0,
        canAutoPay: b.handyman.stripeAccountStatus === "active",
      });
    }
    const entry = byHandyman.get(key)!;
    entry.bookings.push(b);
    entry.totalOwed += handymanNet(b.totalPrice);
  }

  return NextResponse.json(Array.from(byHandyman.values()));
}
