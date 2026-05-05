"use client";

import { useState, useEffect } from "react";
import { Users, Activity, DollarSign, AlertTriangle, Clock, UserPlus, Wifi } from "lucide-react";

type Stats = {
  activeBookings: number;
  pendingBookings: number;
  todayRevenue: number;
  todaySignups: number;
  openDisputes: number;
  totalUsers: number;
  totalRevenue: number;
  updatedAt: string;
};

export default function LiveAdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [live, setLive] = useState(false);

  const load = () =>
    fetch("/api/admin/stats/live")
      .then(r => r.json())
      .then(d => { setStats(d); setLive(true); })
      .catch(() => setLive(false));

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  const tiles = [
    { label: "Active Jobs", value: stats.activeBookings, icon: Activity, color: "text-tarea-sky", pulse: stats.activeBookings > 0 },
    { label: "Pending Review", value: stats.pendingBookings, icon: Clock, color: "text-amber-400", pulse: stats.pendingBookings > 0 },
    { label: "Revenue Today", value: fmt(stats.todayRevenue), icon: DollarSign, color: "text-emerald-400", pulse: false },
    { label: "Signups Today", value: stats.todaySignups, icon: UserPlus, color: "text-violet-400", pulse: false },
    { label: "Open Disputes", value: stats.openDisputes, icon: AlertTriangle, color: "text-red-400", pulse: stats.openDisputes > 0 },
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-slate-300", pulse: false },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">Live Stats</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${live ? "text-emerald-400" : "text-slate-500"}`}>
          <Wifi className="w-3 h-3" />
          {live ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Connecting…"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(({ label, value, icon: Icon, color, pulse }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden">
            {pulse && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current animate-ping opacity-75" style={{ color: "inherit" }} />
            )}
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
