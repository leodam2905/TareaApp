"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, DollarSign, Receipt, TrendingUp, BarChart3 } from "lucide-react";
import { formatCurrency, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetch("/api/reports/spending")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setTimeout(() => setMounted(true), 100); });
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
    <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-extrabold text-white">Spending Report</h1>
        <p className="text-slate-400 mt-1">Your complete spending history on Tarea</p>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={stagger} className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Spent",  value: formatCurrency(data.totalSpent),    icon: DollarSign, color: "text-tarea-sky"   },
          { label: "Bookings",     value: data.bookingCount,                   icon: Receipt,    color: "text-emerald-400" },
          { label: "Avg per Job",  value: formatCurrency(avgPerBooking),       icon: TrendingUp, color: "text-amber-400"   },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5"
          >
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Monthly chart */}
      <motion.div variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-tarea-sky" /> Spending Last 6 Months
        </h2>
        {data.months.every(m => m.amount === 0) ? (
          <p className="text-slate-500 text-sm text-center py-6">No spending data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {data.months.map(({ label, amount }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <span className="text-slate-400 text-[10px]">{amount > 0 ? formatCurrency(amount) : ""}</span>
                <div className="w-full flex items-end justify-center">
                  <div
                    className="w-full bg-tarea-sky/80 rounded-t-lg transition-all duration-700 ease-out"
                    style={{ height: mounted ? `${Math.max(4, (amount / maxMonth) * 100)}px` : "4px" }}
                  />
                </div>
                <span className="text-slate-500 text-[10px]">{label}</span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* By category */}
      {categoryEntries.length > 0 && (
        <motion.div variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-bold">Spending by Category</h2>
          <div className="space-y-3">
            {categoryEntries.map(([cat, amount], i) => (
              <motion.div
                key={cat}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 flex items-center gap-2">
                    <CategoryIcon catKey={cat} className="w-4 h-4" />
                    {SERVICE_CATEGORY_LABELS[cat] || cat}
                  </span>
                  <span className="text-white font-semibold">{formatCurrency(amount)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tarea-sky rounded-full transition-all duration-700 ease-out"
                    style={{ width: mounted ? `${(amount / maxCategory) * 100}%` : "0%" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent transactions */}
      <motion.div variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold">Recent Transactions</h2>
        {data.recent.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No completed bookings yet</p>
        ) : (
          <motion.div variants={stagger} className="space-y-2">
            {data.recent.map(tx => (
              <motion.div
                key={tx.id}
                variants={fadeUp}
                whileHover={{ x: 4, transition: { duration: 0.15 } }}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
              >
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
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

    </motion.div>
  );
}
