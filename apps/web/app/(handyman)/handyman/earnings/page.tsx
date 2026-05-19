import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, DollarSign, CheckCircle2, Star, Clock, ArrowDownCircle, FileDown } from "lucide-react";
import EarningsChart from "@/components/ui/EarningsChart";
import CashoutButton from "@/components/ui/CashoutButton";
import TaxReportDownload from "@/components/ui/TaxReportDownload";
import { handymanNet } from "@/lib/fees";

const MIN_CASHOUT = 10;

export default async function HandymanEarningsPage() {
  const user = await getCurrentUser();
  if (!user || !user.handymanProfile) return null;

  const profile = user.handymanProfile;

  const [completedBookings, unpaidBookings, paidOutBookings] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED" },
      include: { service: true, customer: { select: { name: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", isPaid: true, handymanPaidOut: false },
      select: { totalPrice: true },
    }),
    prisma.booking.findMany({
      where: { handymanId: user.id, status: "COMPLETED", handymanPaidOut: true },
      include: { service: { select: { title: true } } },
      orderBy: { paidOutAt: "desc" },
      take: 10,
    }),
  ]);

  const now = new Date();
  const thisMonth = completedBookings.filter(b => {
    const d = b.completedAt || b.updatedAt;
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthEarnings = thisMonth.reduce((s, b) => s + handymanNet(b.totalPrice), 0);

  const lastMonth = completedBookings.filter(b => {
    const d = b.completedAt || b.updatedAt;
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  const lastMonthEarnings = lastMonth.reduce((s, b) => s + handymanNet(b.totalPrice), 0);
  const pctChange = lastMonthEarnings > 0 ? ((monthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100 : null;

  const availableBalance = unpaidBookings.reduce((s, b) => s + handymanNet(b.totalPrice), 0);
  const instantFeeAmount = Math.max(0.5, availableBalance * 0.01);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Earnings</h1>
        <p className="text-slate-400 mt-1">Track your income and cash out your earnings</p>
      </div>

      {/* Cashout widget */}
      <CashoutButton
        available={availableBalance}
        minCashout={MIN_CASHOUT}
        instantFee={instantFeeAmount}
        stripeStatus={user.stripeAccountStatus ?? "not_connected"}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "All-Time Earnings", value: formatCurrency(profile.totalEarnings), icon: DollarSign, color: "text-emerald-400" },
          {
            label: "This Month",
            value: formatCurrency(monthEarnings),
            icon: TrendingUp,
            color: "text-tarea-sky",
            sub: pctChange !== null ? `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}% vs last month` : undefined,
            subColor: pctChange !== null && pctChange >= 0 ? "text-emerald-400" : "text-red-400",
          },
          { label: "Jobs Completed", value: profile.totalJobs, icon: CheckCircle2, color: "text-violet-400" },
          { label: "Avg. Rating", value: `${profile.rating.toFixed(1)} ★`, icon: Star, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color, sub, subColor }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-sm">{label}</p>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* Interactive chart */}
      <EarningsChart />

      {/* Tax / 1099 annual report */}
      <TaxReportDownload />

      {/* Payout history */}
      {paidOutBookings.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <ArrowDownCircle className="w-5 h-5 text-tarea-sky" />
            <h2 className="text-lg font-bold text-white">Payout History</h2>
          </div>
          <div className="space-y-3">
            {paidOutBookings.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center">
                    <ArrowDownCircle className="w-4 h-4 text-tarea-sky" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{b.service.title}</p>
                    <p className="text-slate-500 text-xs">{formatDate(b.paidOutAt ?? b.completedAt ?? b.updatedAt)}</p>
                  </div>
                </div>
                <p className="text-tarea-sky font-bold">+{formatCurrency(handymanNet(b.totalPrice))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-bold text-white">Job History</h2>
        </div>
        {completedBookings.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No completed jobs yet.</p>
        ) : (
          <div className="space-y-3">
            {completedBookings.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{b.service.title}</p>
                    <p className="text-slate-400 text-sm">{b.customer.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold text-lg">+{formatCurrency(handymanNet(b.totalPrice))}</p>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    {b.handymanPaidOut
                      ? <span className="text-xs text-tarea-sky">Paid out</span>
                      : <span className="text-xs text-amber-400">Pending cashout</span>}
                    <span className="text-slate-500 text-xs">{formatDate(b.completedAt || b.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
