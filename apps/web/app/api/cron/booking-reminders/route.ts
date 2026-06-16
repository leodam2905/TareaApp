export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(_req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const win = 10 * 60 * 1000; // ±10 min window around each trigger point

  const windows = [
    {
      hours: 24,
      title: "Booking tomorrow",
      customer: (t: string) => `Your handyman is scheduled to arrive tomorrow at ${t}. Make sure someone is home.`,
      handyman:  (t: string) => `You have a job tomorrow at ${t}. Review the address and make sure you're prepared.`,
    },
    {
      hours: 3,
      title: "Booking in 3 hours",
      customer: (t: string) => `Your handyman arrives at ${t} — 3 hours from now. Make sure you're home.`,
      handyman:  (t: string) => `You have a job at ${t} — 3 hours from now. Start getting ready.`,
    },
    {
      hours: 2,
      title: "Booking in 2 hours",
      customer: (t: string) => `Your handyman arrives at ${t} — 2 hours from now. Please be available at the address.`,
      handyman:  (t: string) => `You have a job at ${t} — 2 hours from now. Head out soon!`,
    },
    {
      hours: 1,
      title: "Booking in 1 hour",
      customer: (t: string) => `Your handyman arrives at ${t} — 1 hour away. Be ready to let them in.`,
      handyman:  (t: string) => `You have a job at ${t} — 1 hour away. Time to head out!`,
    },
  ];

  // Fetch all bookings that fall within any of the reminder windows
  const earliest = new Date(now.getTime() + (1 * 60 * 60 * 1000) - win);
  const latest   = new Date(now.getTime() + (24 * 60 * 60 * 1000) + win);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      scheduledAt: { gte: earliest, lte: latest },
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
    const timeStr = scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    for (const w of windows) {
      const target = new Date(now.getTime() + w.hours * 60 * 60 * 1000);
      const inWindow = scheduledAt >= new Date(target.getTime() - win) &&
                       scheduledAt <= new Date(target.getTime() + win);
      if (!inWindow) continue;

      await Promise.allSettled([
        createNotification({ userId: booking.customer.id, title: w.title, body: w.customer(timeStr), type: "booking_reminder", refId: booking.id }),
        createNotification({ userId: booking.handyman.id, title: w.title, body: w.handyman(timeStr),  type: "booking_reminder", refId: booking.id }),
      ]);
      sent += 2;
    }
  }

  return NextResponse.json({ sent, checked: bookings.length, timestamp: now.toISOString() });
}
