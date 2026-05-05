import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CalendarCheck, Search, Star, Clock } from "lucide-react";
import { formatCurrency, formatDate, SERVICE_CATEGORY_ICONS } from "@/lib/utils";

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

  const statusColor: Record<string, string> = {
    PENDING: "badge-yellow",
    ACCEPTED: "badge-sky",
    IN_PROGRESS: "badge-sky",
    COMPLETED: "badge-green",
    CANCELLED: "badge-red",
    DISPUTED: "badge-red",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            Good day, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-400 mt-1">Here's what's happening with your bookings.</p>
        </div>
        <Link href="/customer/browse" className="btn-secondary">
          Find a Handyman
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "Total Bookings", value: bookings.length, icon: CalendarCheck, color: "text-tarea-sky" },
          { label: "Active Jobs", value: bookings.filter((b) => ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(b.status)).length, icon: Clock, color: "text-amber-400" },
          { label: "Completed", value: bookings.filter((b) => b.status === "COMPLETED").length, icon: Star, color: "text-emerald-400" },
          { label: "Total Spent", value: formatCurrency(totalSpent), icon: Search, color: "text-violet-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-sm font-medium">{label}</p>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Recent Bookings</h2>
          <Link href="/customer/bookings" className="text-tarea-sky text-sm font-medium hover:underline">
            View all →
          </Link>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-400">No bookings yet.</p>
            <Link href="/customer/browse" className="btn-secondary mt-4 inline-block">
              Browse Services
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-tarea-sky/20 transition-colors">
                <div className="w-10 h-10 bg-tarea-dark/60 rounded-xl flex items-center justify-center text-xl">
                  {SERVICE_CATEGORY_ICONS[b.service.category] || "🛠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{b.service.title}</p>
                  <p className="text-slate-400 text-sm">With {b.handyman.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold">{formatCurrency(b.totalPrice)}</p>
                  <p className="text-slate-500 text-xs mt-1">{formatDate(b.scheduledAt)}</p>
                </div>
                <span className={statusColor[b.status] || "badge"}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Services */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Recommended Services</h2>
          <Link href="/customer/browse" className="text-tarea-sky text-sm font-medium hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {recentServices.map((s) => (
            <Link key={s.id} href={`/customer/browse?service=${s.id}`}>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-tarea-sky/30 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{SERVICE_CATEGORY_ICONS[s.category] || "🛠️"}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{s.title}</p>
                    <p className="text-slate-400 text-xs">{s.handyman?.user.name ?? "Platform Service"}</p>
                  </div>
                </div>
                <p className="text-tarea-sky font-bold text-sm">
                  {formatCurrency(s.minPrice)} – {formatCurrency(s.maxPrice)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
