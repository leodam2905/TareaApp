"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

type Handyman = {
  id: string; rating: number; totalJobs: number; totalEarnings: number;
  serviceRadius: number; verificationStatus: string; verificationDocUrl: string | null;
  user: { name: string; email: string; isVerified: boolean; stripeAccountStatus: string | null };
};

export default function AdminHandymenPage() {
  const [handymen, setHandymen] = useState<Handyman[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/handymen").then(r => r.json()).then(data => {
      setHandymen(Array.isArray(data) ? data : []);
    }).finally(() => setLoading(false));
  }, []);

  const verify = async (id: string, decision: "approve" | "reject") => {
    const res = await fetch(`/api/admin/verification/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      toast.success(decision === "approve" ? "Handyman verified!" : "Verification rejected");
      setHandymen(prev => prev.map(h => h.id !== id ? h : {
        ...h,
        verificationStatus: decision === "approve" ? "approved" : "rejected",
        user: { ...h.user, isVerified: decision === "approve" ? true : h.user.isVerified },
      }));
    } else {
      toast.error("Action failed");
    }
  };

  const filtered = handymen.filter(h =>
    filter === "ALL" ? true :
    filter === "PENDING" ? h.verificationStatus === "pending" :
    filter === "VERIFIED" ? h.user.isVerified : true
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Handymen</h1>
        <p className="text-slate-400 mt-1">All registered handyman profiles, sorted by earnings</p>
      </div>

      <div className="flex gap-3">
        {["ALL", "PENDING", "VERIFIED"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? "bg-tarea-sky text-tarea-ink" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            {f === "PENDING" ? "🟡 Pending Verification" : f}
            {f === "PENDING" && handymen.filter(h => h.verificationStatus === "pending").length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {handymen.filter(h => h.verificationStatus === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {["Name / Email", "Rating", "Jobs", "Earnings", "Radius", "Verification", "Stripe", "Actions"].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-4 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan={8} className="text-center text-slate-500 py-10">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-10">No handymen found</td></tr>}
            {!loading && filtered.map(h => (
              <tr key={h.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-tarea-sky/20 rounded-full flex items-center justify-center text-tarea-sky font-bold text-sm flex-shrink-0">
                      {h.user.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{h.user.name}</p>
                      <p className="text-slate-400 text-xs">{h.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4"><span className="text-amber-400 font-semibold text-sm">⭐ {h.rating.toFixed(1)}</span></td>
                <td className="px-4 py-4 text-slate-300 text-sm">{h.totalJobs}</td>
                <td className="px-4 py-4"><span className="text-emerald-400 font-semibold text-sm">{formatCurrency(h.totalEarnings)}</span></td>
                <td className="px-4 py-4 text-slate-300 text-sm">{h.serviceRadius} mi</td>
                <td className="px-4 py-4">
                  {h.verificationStatus === "pending" ? (
                    <div className="flex items-center gap-2">
                      <span className="badge-yellow">Pending</span>
                      {h.verificationDocUrl && (
                        <a href={h.verificationDocUrl} target="_blank" rel="noreferrer" title="View document">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                        </a>
                      )}
                    </div>
                  ) : h.user.isVerified ? (
                    <span className="badge-sky">✓ Verified</span>
                  ) : h.verificationStatus === "rejected" ? (
                    <span className="badge-red">Rejected</span>
                  ) : (
                    <span className="text-slate-500 text-xs">None</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {h.user.stripeAccountStatus === "active" ? (
                    <span className="badge-green">Active</span>
                  ) : h.user.stripeAccountStatus === "pending" ? (
                    <span className="badge-yellow">Pending</span>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {h.verificationStatus === "pending" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => verify(h.id, "approve")} title="Approve"
                        className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => verify(h.id, "reject")} title="Reject"
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
