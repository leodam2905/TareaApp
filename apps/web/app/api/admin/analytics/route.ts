import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buckets: { week: number; revenue: number; bookings: number; newUsers: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    // Find the most recent Monday
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon...6=Sat
    const daysToLastMonday = (day === 0 ? 6 : day - 1); // days since Monday
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday - i * 7);
    lastMonday.setUTCHours(0, 0, 0, 0);

    const nextMonday = new Date(lastMonday);
    nextMonday.setUTCDate(lastMonday.getUTCDate() + 7);

    const [completedBookings, bookingCount, userCount] = await Promise.all([
      prisma.booking.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: lastMonday, lt: nextMonday },
        },
        select: { totalPrice: true },
      }),
      prisma.booking.count({
        where: {
          createdAt: { gte: lastMonday, lt: nextMonday },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: lastMonday, lt: nextMonday },
        },
      }),
    ]);

    const revenue = completedBookings.reduce((sum, b) => sum + b.totalPrice * 0.2, 0);

    buckets.push({
      week: 12 - i, // week 1 = oldest, week 12 = most recent
      revenue: Math.round(revenue * 100) / 100,
      bookings: bookingCount,
      newUsers: userCount,
    });
  }

  return NextResponse.json(buckets);
}
