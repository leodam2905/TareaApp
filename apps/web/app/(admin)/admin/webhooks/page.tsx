"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, Zap, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type WebhookEvent = {
  id: string;
  eventId: string;
  type: string;
  status: string;
  createdAt: string;
};

export default function AdminWebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = async (status?: string) => {
    setLoading(true);
    const qs = status && status !== "all" ? `?status=${status}` : "";
    const res = await fetch(`/api/admin/webhooks${qs}`);
    const data = await res.json();
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const retry = async (id: string) => {
    setRetrying(id);
    const res = await fetch(`/api/admin/webhooks/${id}/retry`, { method: "POST" });
    if (res.ok) {
      toast.success("Event replayed successfully");
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: "processed" } : e));
    } else {
      toast.error("Retry failed");
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: "failed" } : e));
    }
    setRetrying(null);
  };

  const stats = {
    total: events.length,
    processed: events.filter((e) => e.status === "processed").length,
    failed: events.filter((e) => e.status === "failed").length,
  };

  const eventTypeColor: Record<string, string> = {
    "checkout.session.completed": "text-emerald-400",
    "customer.subscription.deleted": "text-red-400",
    "customer.subscription.updated": "text-amber-400",
    "charge.refunded": "text-violet-400",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Stripe Webhooks</h1>
          <p className="text-slate-400 mt-1">Last 100 incoming events · Click Retry to replay failed events</p>
        </div>
        <button
          onClick={() => load(filter)}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Processed", value: stats.processed, color: "text-emerald-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "processed", "failed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize",
              filter === f
                ? "bg-tarea-sky text-tarea-ink"
                : "bg-white/5 text-slate-400 hover:bg-white/10",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Events table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No webhook events recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-slate-400 font-medium">Event Type</th>
                <th className="text-left px-6 py-4 text-slate-400 font-medium">Event ID</th>
                <th className="text-left px-6 py-4 text-slate-400 font-medium">Status</th>
                <th className="text-left px-6 py-4 text-slate-400 font-medium">Received</th>
                <th className="text-left px-6 py-4 text-slate-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={cn("font-mono font-medium", eventTypeColor[e.type] ?? "text-slate-300")}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                    {e.eventId.slice(0, 24)}…
                  </td>
                  <td className="px-6 py-4">
                    {e.status === "processed" ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle className="w-4 h-4" /> processed
                      </span>
                    ) : e.status === "retrying" ? (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> retrying
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-red-400">
                        <XCircle className="w-4 h-4" /> failed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {e.status === "failed" && (
                      <button
                        onClick={() => retry(e.id)}
                        disabled={retrying === e.id}
                        className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        {retrying === e.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
