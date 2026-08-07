import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { completeBooking } from "@/lib/complete-booking";

const AUTO_RELEASE_DAYS = 3;

// Safety net: if the pro marked work done but the customer hasn't confirmed
// within 3 days, auto-complete the booking and release the full payout
// (labor net + materials) so pros aren't left unpaid.
export async function GET(_req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.booking.findMany({
    where: {
      status: "IN_PROGRESS",
      isPaid: true,
      handymanPaidOut: false,
      workDoneAt: { not: null, lte: cutoff },
    },
    select: { id: true },
  });

  let released = 0;
  for (const b of due) {
    try {
      await completeBooking(b.id);
      released++;
    } catch (err) {
      console.error("[cron/auto-release] failed for", b.id, err);
    }
  }

  return NextResponse.json({ checked: due.length, released });
}
