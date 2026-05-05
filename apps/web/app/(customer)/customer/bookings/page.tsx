import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BookingsView from "@/components/ui/BookingsView";

export default async function CustomerBookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    include: {
      service: { select: { title: true, category: true } },
      handyman: { select: { name: true, avatarUrl: true, phone: true } },
      review: true,
    },
    orderBy: { scheduledAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">My Bookings</h1>
        <p className="text-slate-400 mt-1">Track all your service appointments</p>
      </div>
      <BookingsView
        bookings={bookings.map(b => ({ ...b, isOnMyWay: (b as any).isOnMyWay ?? false }))}
        role="CUSTOMER"
        emptyHref="/customer/browse"
        emptyLabel="Browse Services"
        baseHref="/customer/bookings"
      />
    </div>
  );
}
