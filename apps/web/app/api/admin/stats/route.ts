import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { platformRevenue } from "@/lib/fees";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [totalUsers, totalBookings, totalServices, revenueAgg, disputes, newUsersThisWeek] =
    await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { totalPrice: true } }),
      prisma.booking.count({ where: { status: "DISPUTED" } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

  return NextResponse.json({
    totalUsers,
    totalBookings,
    totalServices,
    totalRevenue: platformRevenue(revenueAgg._sum.totalPrice ?? 0),
    disputes,
    newUsersThisWeek,
  });
}
