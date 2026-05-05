"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Loader2 } from "lucide-react";

type Bucket = { label: string; earnings: number; jobs: number };
type Period = "week" | "month" | "year";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-tarea-ink border border-white/20 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-white text-sm font-bold">
          {p.name === "earnings" ? `$${p.value.toFixed(0)}` : `${p.value} job${p.value !== 1 ? "s" : ""}`}
        </p>
      ))}
    </div>
  );
};

export default function EarningsChart() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"earnings" | "jobs">("earnings");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/earnings?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); });
  }, [period]);

  const total = data.reduce((s, d) => s + d.earnings, 0);
  const totalJobs = data.reduce((s, d) => s + d.jobs, 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Earnings Over Time</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {loading ? "Loading…" : `$${total.toFixed(0)} · ${totalJobs} job${totalJobs !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
            {(["earnings", "jobs"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${view === v ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white"}`}>
                {v}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
            {(["week", "month", "year"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${period === p ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-tarea-sky animate-spin" /></div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          {view === "earnings" ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="earnings" stroke="#38BDF8" strokeWidth={2.5} fill="url(#earningsGrad)" dot={{ fill: "#38BDF8", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="jobs" fill="#38BDF8" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
