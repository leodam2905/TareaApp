import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { platformRevenue } from "@/lib/fees";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    activeBookings,
    pendingBookings,
    todayRevAgg,
    todaySignups,
    openDisputes,
    totalUsers,
    totalRevAgg,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: { in: ["ACCEPTED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.aggregate({ where: { status: "COMPLETED", completedAt: { gte: todayStart } }, _sum: { totalPrice: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.booking.count({ where: { status: "DISPUTED" } }),
    prisma.user.count(),
    prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { totalPrice: true } }),
  ]);

  return NextResponse.json({
    activeBookings,
    pendingBookings,
    todayRevenue: platformRevenue(todayRevAgg._sum.totalPrice ?? 0),
    todaySignups,
    openDisputes,
    totalUsers,
    totalRevenue: platformRevenue(totalRevAgg._sum.totalPrice ?? 0),
    updatedAt: new Date().toISOString(),
  });
}
