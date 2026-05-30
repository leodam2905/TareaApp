import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardAnimated from "@/components/ui/DashboardAnimated";

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [bookings, recentServices] = await Promise.all([
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
    />
  );
}
