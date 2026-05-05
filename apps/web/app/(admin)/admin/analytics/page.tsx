"use client";

import { useEffect, useState } from "react";

interface WeekData {
  week: number;
  revenue: number;
  bookings: number;
  newUsers: number;
}

function BarChart({
  data,
  valueKey,
  color,
  label,
  format,
}: {
  data: WeekData[];
  valueKey: keyof WeekData;
  color: string;
  label: string;
  format: (v: number) => string;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const max = Math.max(...values, 1);
  const chartH = 120;
  const barW = 28;
  const gap = 8;
  const paddingTop = 24;
  const labelH = 20;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h3 className="text-white font-semibold text-base mb-4">{label}</h3>
      <div className="overflow-x-auto">
        <svg
          width={totalW}
          height={chartH + paddingTop + labelH + 8}
          style={{ display: "block", minWidth: "100%" }}
          viewBox={`0 0 ${totalW} ${chartH + paddingTop + labelH + 8}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {data.map((d, i) => {
            const val = d[valueKey] as number;
            const barH = max === 0 ? 0 : Math.max(2, (val / max) * chartH);
            const x = i * (barW + gap);
            const y = paddingTop + chartH - barH;

            return (
              <g key={d.week}>
                {/* Value label above bar */}
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgba(255,255,255,0.6)"
                >
                  {format(val)}
                </text>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill={color}
                  rx={4}
                  opacity={0.85}
                />
                {/* Week label below */}
                <text
                  x={x + barW / 2}
                  y={paddingTop + chartH + labelH}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgba(255,255,255,0.4)"
                >
                  W{d.week}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
        else setError(d.error ?? "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-400">
        {error}
      </div>
    );
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalBookings = data.reduce((s, d) => s + d.bookings, 0);
  const totalNewUsers = data.reduce((s, d) => s + d.newUsers, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1">Last 12 weeks of platform activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-2">12-Week Revenue</p>
          <p className="text-2xl font-bold text-emerald-400">${totalRevenue.toFixed(2)}</p>
          <p className="text-slate-500 text-xs mt-1">Platform take (20%)</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-2">Total Bookings</p>
          <p className="text-2xl font-bold text-sky-400">{totalBookings}</p>
          <p className="text-slate-500 text-xs mt-1">All statuses</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm font-medium mb-2">New Users</p>
          <p className="text-2xl font-bold text-purple-400">{totalNewUsers}</p>
          <p className="text-slate-500 text-xs mt-1">Registered this period</p>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <BarChart
          data={data}
          valueKey="revenue"
          color="#10B981"
          label="Revenue (platform 20% take)"
          format={(v) => `$${v.toFixed(0)}`}
        />
        <BarChart
          data={data}
          valueKey="bookings"
          color="#38BDF8"
          label="Bookings Created"
          format={(v) => String(v)}
        />
        <BarChart
          data={data}
          valueKey="newUsers"
          color="#A78BFA"
          label="New Users Registered"
          format={(v) => String(v)}
        />
      </div>
    </div>
  );
}
