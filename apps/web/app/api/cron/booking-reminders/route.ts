import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { headers } from "next/headers";

export async function GET(_req: NextRequest) {
  // Auth: check CRON_SECRET if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = headers().get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // 24h window: scheduledAt between now+23h and now+25h
  const h24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const h24End   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // 1h window: scheduledAt between now+50min and now+70min
  const h1Start = new Date(now.getTime() + 50 * 60 * 1000);
  const h1End   = new Date(now.getTime() + 70 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      scheduledAt: { gte: h1Start, lte: h24End },
    },
    include: {
      service: { select: { title: true } },
      customer: { select: { id: true } },
      handyman: { select: { id: true } },
    },
  });

  let sent = 0;

  for (const booking of bookings) {
    const scheduledAt = new Date(booking.scheduledAt);
    const isH24 = scheduledAt >= h24Start && scheduledAt <= h24End;
    const isH1  = scheduledAt >= h1Start  && scheduledAt <= h1End;

    if (!isH24 && !isH1) continue;

    const timeStr = scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = scheduledAt.toLocaleDateString([], { month: "short", day: "numeric" });

    const title = isH24 ? "Booking tomorrow" : "Booking in 1 hour";
    const body = isH24
      ? `Your booking for ${booking.service.title} is tomorrow at ${timeStr}`
      : `Your booking for ${booking.service.title} starts in about an hour`;

    const notifications = [
      createNotification({ userId: booking.customer.id, title, body, type: "booking_reminder", refId: booking.id }),
      createNotification({ userId: booking.handyman.id, title, body, type: "booking_reminder", refId: booking.id }),
    ];

    await Promise.allSettled(notifications);
    sent += 2;
  }

  return NextResponse.json({ sent, checked: bookings.length, timestamp: now.toISOString() });
}
