import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      handyman: { select: { name: true, email: true } },
      service: { select: { title: true, category: true } },
    },
  });

  const statusColor: Record<string, string> = {
    PENDING: "badge-yellow", ACCEPTED: "badge-sky", IN_PROGRESS: "badge-sky",
    COMPLETED: "badge-green", CANCELLED: "badge-red", DISPUTED: "badge-red",
  };

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === "PENDING").length,
    active: bookings.filter(b => ["ACCEPTED", "IN_PROGRESS"].includes(b.status)).length,
    completed: bookings.filter(b => b.status === "COMPLETED").length,
    disputed: bookings.filter(b => b.status === "DISPUTED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Bookings</h1>
        <p className="text-slate-400 mt-1">All platform bookings and disputes</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
            <span className="text-slate-400 capitalize">{key}:</span>
            <span className="text-white font-bold ml-1">{val}</span>
          </div>
        ))}
      </div>

      {/* Disputed alert */}
      {counts.disputed > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 font-medium">
          ⚠ {counts.disputed} booking{counts.disputed > 1 ? "s are" : " is"} disputed and need your attention.
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {["Service", "Customer", "Handyman", "Amount", "Scheduled", "Status"].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-5 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bookings.map(b => (
              <tr key={b.id} className={`hover:bg-white/5 transition-colors ${b.status === "DISPUTED" ? "bg-red-500/5" : ""}`}>
                <td className="px-5 py-4">
                  <p className="text-white text-sm font-medium">{b.service.title}</p>
                  <p className="text-slate-500 text-xs">{b.service.category}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-white text-sm">{b.customer.name}</p>
                  <p className="text-slate-500 text-xs">{b.customer.email}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-white text-sm">{b.handyman.name}</p>
                  <p className="text-slate-500 text-xs">{b.handyman.email}</p>
                </td>
                <td className="px-5 py-4 text-emerald-400 font-bold text-sm">{formatCurrency(b.totalPrice)}</td>
                <td className="px-5 py-4 text-slate-400 text-sm">{formatDate(b.scheduledAt)}</td>
                <td className="px-5 py-4">
                  <span className={statusColor[b.status] || "badge"}>{b.status.replace("_", " ")}</span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-10">No bookings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
