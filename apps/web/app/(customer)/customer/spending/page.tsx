"use client";

import { useState, useEffect } from "react";
import { Loader2, DollarSign, Receipt, TrendingUp, BarChart3 } from "lucide-react";
import { formatCurrency, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

type SpendingData = {
  totalSpent: number;
  bookingCount: number;
  byCategory: Record<string, number>;
  months: { label: string; amount: number }[];
  recent: { id: string; title: string; category: string; amount: number; date: string }[];
};

export default function SpendingPage() {
  const [data, setData] = useState<SpendingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/spending")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const avgPerBooking = data.bookingCount > 0 ? data.totalSpent / data.bookingCount : 0;
  const maxMonth = Math.max(...data.months.map(m => m.amount), 1);
  const categoryEntries = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(...categoryEntries.map(([, v]) => v), 1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Spending Report</h1>
        <p className="text-slate-400 mt-1">Your complete spending history on Tarea</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Spent", value: formatCurrency(data.totalSpent), icon: DollarSign, color: "text-tarea-sky" },
          { label: "Bookings", value: data.bookingCount, icon: Receipt, color: "text-emerald-400" },
          { label: "Avg per Job", value: formatCurrency(avgPerBooking), icon: TrendingUp, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-tarea-sky" /> Spending Last 6 Months
        </h2>
        {data.months.every(m => m.amount === 0) ? (
          <p className="text-slate-500 text-sm text-center py-6">No spending data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {data.months.map(({ label, amount }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">{amount > 0 ? formatCurrency(amount) : ""}</span>
                <div className="w-full flex items-end justify-center">
                  <div
                    className="w-full bg-tarea-sky/80 rounded-t-lg transition-all duration-500"
                    style={{ height: `${Math.max(4, (amount / maxMonth) * 100)}px` }}
                  />
                </div>
                <span className="text-slate-500 text-[10px]">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By category */}
      {categoryEntries.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-bold">Spending by Category</h2>
          <div className="space-y-3">
            {categoryEntries.map(([cat, amount]) => (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 flex items-center gap-2">
                    <CategoryIcon catKey={cat} className="w-4 h-4" />
                    {SERVICE_CATEGORY_LABELS[cat] || cat}
                  </span>
                  <span className="text-white font-semibold">{formatCurrency(amount)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tarea-sky rounded-full"
                    style={{ width: `${(amount / maxCategory) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold">Recent Transactions</h2>
        {data.recent.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No completed bookings yet</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CategoryIcon catKey={tx.category} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{tx.title}</p>
                  <p className="text-slate-500 text-xs">
                    {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className="text-tarea-sky font-bold text-sm flex-shrink-0">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
