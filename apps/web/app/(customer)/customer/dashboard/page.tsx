import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardAnimated from "@/components/ui/DashboardAnimated";

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [bookings, recentServices, upcomingBooking, favoritesCount] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id },
      include: {
        service: true,
        handyman: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.service.findMany({
      where: { isActive: true },
      include: { handyman: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.booking.findFirst({
      where: {
        customerId: user.id,
        scheduledAt: { gte: new Date() },
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
      },
      include: {
        service: { select: { title: true, category: true } },
        handyman: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.favorite.count({ where: { customerId: user.id } }),
  ]);

  const totalSpent = bookings
    .filter((b) => b.status === "COMPLETED")
    .reduce((s, b) => s + b.totalPrice, 0);

  const activeJobs = bookings.filter((b) =>
    ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(b.status)
  ).length;

  return (
    <DashboardAnimated
      user={{ name: user.name }}
      bookings={bookings}
      recentServices={recentServices}
      totalSpent={totalSpent}
      activeJobs={activeJobs}
      upcomingBooking={upcomingBooking}
      favoritesCount={favoritesCount}
    />
  );
}
