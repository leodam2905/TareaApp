import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import LiveAdminStats from "@/components/ui/LiveAdminStats";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    customers,
    handymen,
    totalBookings,
    pendingBookings,
    disputes,
    revenueAgg,
    activeServices,
    newUsersThisWeek,
    recentBookings,
    topHandymen,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "HANDYMAN" } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "DISPUTED" } }),
    prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { totalPrice: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        handyman: { select: { name: true } },
        service: { select: { title: true } },
      },
    }),
    prisma.handymanProfile.findMany({
      take: 5,
      orderBy: { totalEarnings: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.totalPrice ?? 0;

  const statusColor: Record<string, string> = {
    PENDING: "badge-yellow",
    ACCEPTED: "badge-sky",
    IN_PROGRESS: "badge-sky",
    COMPLETED: "badge-green",
    CANCELLED: "badge-red",
    DISPUTED: "badge-red",
  };

  const stats = [
    { label: "Total Users",      value: totalUsers,                    sub: `${customers} customers · ${handymen} handymen`, color: "text-tarea-sky" },
    { label: "Total Bookings",   value: totalBookings,                 sub: `${pendingBookings} pending`,                    color: "text-purple-400" },
    { label: "Platform Revenue", value: formatCurrency(totalRevenue),  sub: "from completed jobs",                           color: "text-emerald-400" },
    { label: "Active Services",  value: activeServices,                sub: "listed by handymen",                            color: "text-orange-400" },
    { label: "Open Disputes",    value: disputes,                      sub: "need resolution",                               color: "text-red-400" },
    { label: "New This Week",    value: newUsersThisWeek,              sub: "new registrations",                             color: "text-tarea-sky" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Admin Dashboard</h1>
        <p className="text-slate-400 mt-1">Platform overview and key metrics</p>
      </div>

      {/* Live stats — polls every 30s */}
      <LiveAdminStats />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {stats.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-slate-400 text-sm font-medium mb-3">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {disputes > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 font-medium">
          ⚠ {disputes} booking{disputes > 1 ? "s are" : " is"} disputed and need your attention.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Bookings</h2>
          {recentBookings.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No bookings yet</p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white text-sm font-medium">{b.service.title}</p>
                    <p className="text-slate-400 text-xs">{b.customer.name} → {b.handyman.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-bold">{formatCurrency(b.totalPrice)}</p>
                    <span className={`${statusColor[b.status] || "badge"} text-xs`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top handymen */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Top Handymen by Earnings</h2>
          {topHandymen.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No handymen yet</p>
          ) : (
            <div className="space-y-3">
              {topHandymen.map((h, i) => (
                <div key={h.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                  <span className="text-2xl font-black text-slate-600">#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{h.user.name}</p>
                    <p className="text-slate-400 text-xs">{h.user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold text-sm">{formatCurrency(h.totalEarnings)}</p>
                    <p className="text-slate-500 text-xs">{h.totalJobs} jobs · {h.rating.toFixed(1)}★</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
