export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(_req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find accepted, unpaid bookings whose payment deadline has passed
  const expired = await prisma.booking.findMany({
    where: {
      status: "ACCEPTED",
      isPaid: false,
      responseDeadline: { lt: new Date() },
    },
    include: {
      service: { select: { title: true } },
      customer: { select: { name: true } },
      handyman: { select: { name: true } },
    },
  });

  if (expired.length === 0) return NextResponse.json({ cancelled: 0 });

  const ids = expired.map(b => b.id);

  await prisma.booking.updateMany({
    where: { id: { in: ids } },
    data: { status: "CANCELLED", cancelReason: "Payment not completed within 2 hours." },
  });

  // Notify both parties for each expired booking
  await Promise.allSettled(
    expired.flatMap(b => [
      createNotification({
        userId: b.customerId,
        title: "Booking cancelled — payment timeout",
        body: `Your booking for "${b.service.title}" was automatically cancelled because payment was not completed within 2 hours. You can rebook anytime.`,
        type: "booking_cancelled",
        refId: b.id,
      }),
      createNotification({
        userId: b.handymanId,
        title: "Booking cancelled — customer didn't pay",
        body: `The customer did not complete payment for "${b.service.title}" within 2 hours. The booking has been cancelled and you are free to take other jobs.`,
        type: "booking_cancelled",
        refId: b.id,
      }),
    ])
  );

  console.log(`[expire-bookings] Auto-cancelled ${expired.length} unpaid booking(s):`, ids);
  return NextResponse.json({ cancelled: expired.length, ids });
}
