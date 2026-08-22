export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { RESPONSE_WINDOW_HOURS } from "@/lib/booking-deadlines";

// `responseDeadline` carries both halves of a directed booking's clock: the pro
// has 2 hours to accept, then the customer has 2 hours to pay if the card on
// file could not be charged. BOTH have to expire.
//
// Only the payment half used to be swept, so a directed booking the pro simply
// never answered sat PENDING for ever: the customer was told "the handyman will
// respond within 2 hours", waited, and nothing — no acceptance, no cancellation,
// no way to tell whether to book somebody else. Job-request hires cannot appear
// here at all any more; they are only created once paid (see lib/hire.ts).
const REASONS = {
  PENDING: `Handyman did not respond within ${RESPONSE_WINDOW_HOURS} hours.`,
  ACCEPTED: `Payment not completed within ${RESPONSE_WINDOW_HOURS} hours.`,
} as const;

export async function GET(_req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.booking.findMany({
    where: {
      // PENDING = the pro never answered. ACCEPTED + unpaid = the customer
      // never paid (the card charge at acceptance having failed).
      status: { in: ["PENDING", "ACCEPTED"] },
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

  // Two populations, two reasons — cancelled separately so a customer who was
  // stood up is never told they failed to pay.
  const byStatus = {
    PENDING: expired.filter(b => b.status === "PENDING"),
    ACCEPTED: expired.filter(b => b.status === "ACCEPTED"),
  };

  for (const status of ["PENDING", "ACCEPTED"] as const) {
    const group = byStatus[status];
    if (group.length === 0) continue;
    await prisma.booking.updateMany({
      where: { id: { in: group.map(b => b.id) } },
      data: { status: "CANCELLED", cancelReason: REASONS[status] },
    });
  }

  await Promise.allSettled(
    expired.flatMap(b =>
      b.status === "PENDING"
        ? [
            createNotification({
              userId: b.customerId,
              title: "Booking cancelled — no response",
              body: `${b.handyman.name} did not respond to your request for "${b.service.title}" within ${RESPONSE_WINDOW_HOURS} hours, so it was cancelled. You were not charged — browse other pros to rebook.`,
              type: "booking_cancelled",
              refId: b.id,
            }),
            createNotification({
              userId: b.handymanId,
              title: "You missed a booking request",
              body: `You did not respond to "${b.service.title}" within ${RESPONSE_WINDOW_HOURS} hours, so the request was cancelled and the customer is free to hire someone else.`,
              type: "booking_cancelled",
              refId: b.id,
            }),
          ]
        : [
            createNotification({
              userId: b.customerId,
              title: "Booking cancelled — payment timeout",
              body: `Your booking for "${b.service.title}" was automatically cancelled because payment was not completed within ${RESPONSE_WINDOW_HOURS} hours. You can rebook anytime.`,
              type: "booking_cancelled",
              refId: b.id,
            }),
            createNotification({
              userId: b.handymanId,
              title: "Booking cancelled — customer didn't pay",
              body: `The customer did not complete payment for "${b.service.title}" within ${RESPONSE_WINDOW_HOURS} hours. The booking has been cancelled and you are free to take other jobs.`,
              type: "booking_cancelled",
              refId: b.id,
            }),
          ]
    )
  );

  const ids = expired.map(b => b.id);
  console.log(
    `[expire-bookings] Auto-cancelled ${ids.length} booking(s):`,
    `${byStatus.PENDING.length} unanswered, ${byStatus.ACCEPTED.length} unpaid —`,
    ids,
  );
  return NextResponse.json({
    cancelled: ids.length,
    unanswered: byStatus.PENDING.length,
    unpaid: byStatus.ACCEPTED.length,
    ids,
  });
}
