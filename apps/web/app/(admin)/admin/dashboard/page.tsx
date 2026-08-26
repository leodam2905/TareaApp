export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import LiveAdminStats from "@/components/ui/LiveAdminStats";
import Link from "next/link";
import {
  Users, BookOpen, DollarSign, Wrench,
  AlertTriangle, UserPlus, ArrowRight, Trophy,
} from "lucide-react";

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
    {
      label: "Total Users",
      value: totalUsers,
      sub: `${customers} customers · ${handymen} handymen`,
      icon: Users,
      iconBg: "bg-sky-500/15",
      iconColor: "text-tarea-sky",
    },
    {
      label: "Total Bookings",
      value: totalBookings,
      sub: `${pendingBookings} pending`,
      icon: BookOpen,
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-400",
    },
    {
      label: "Platform Revenue",
      value: formatCurrency(totalRevenue),
      sub: "from completed jobs",
      icon: DollarSign,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
    },
    {
      label: "Active Services",
      value: activeServices,
      sub: "listed by handymen",
      icon: Wrench,
      iconBg: "bg-orange-500/15",
      iconColor: "text-orange-400",
    },
    {
      label: "Open Disputes",
      value: disputes,
      sub: "need resolution",
      icon: AlertTriangle,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-400",
    },
    {
      label: "New This Week",
      value: newUsersThisWeek,
      sub: "new registrations",
      icon: UserPlus,
      iconBg: "bg-sky-500/15",
      iconColor: "text-tarea-sky",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">Platform overview and key metrics</p>
        </div>
        <LiveAdminStats />
      </div>

      {/* Disputes alert */}
      {disputes > 0 && (
        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 font-semibold text-sm">
              {disputes} booking{disputes > 1 ? "s are" : " is"} disputed and need your attention.
            </p>
          </div>
          <Link
            href="/admin/bookings?filter=DISPUTED"
            className="flex items-center gap-1 text-red-300 text-sm font-bold hover:underline whitespace-nowrap"
          >
            Review <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
          <div
            key={label}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${iconColor}`}>{value}</p>
            <p className="text-white text-sm font-medium mt-0.5">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-base font-bold text-white">Recent Bookings</h2>
            <Link
              href="/admin/bookings"
              className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">No bookings yet</p>
          ) : (
            <div className="divide-y divide-white/5">
              {recentBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="text-white text-sm font-medium truncate">{b.service.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {b.customer.name} → {b.handyman.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm font-bold">{formatCurrency(b.totalPrice)}</p>
                    <span className={`${statusColor[b.status] || "badge"} text-xs`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top handymen */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Top Handymen</h2>
            </div>
            <Link
              href="/admin/users?role=HANDYMAN"
              className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {topHandymen.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">No handymen yet</p>
          ) : (
            <div className="divide-y divide-white/5">
              {topHandymen.map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      i === 0
                        ? "bg-amber-400/20 text-amber-400"
                        : i === 1
                        ? "bg-tarea-ink-subtle/20 text-slate-400"
                        : i === 2
                        ? "bg-orange-400/20 text-orange-400"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{h.user.name}</p>
                    <p className="text-slate-400 text-xs truncate">{h.user.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-emerald-400 font-bold text-sm">
                      {formatCurrency(h.totalEarnings)}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {h.totalJobs} jobs · {h.rating.toFixed(1)}★
                    </p>
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
