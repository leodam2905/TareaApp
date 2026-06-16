"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronUp, Shield, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

type Checklist = {
  ica: boolean;
  profile: boolean;
  services: boolean;
  availability: boolean;
  backgroundCheck: boolean;
  stripe: boolean;
};

type Handyman = {
  id: string;
  rating: number;
  totalJobs: number;
  totalEarnings: number;
  backgroundCheckStatus: string;
  verificationStatus: string;
  isPremium: boolean;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  licenseNumber: string | null;
  licenseDocUrl: string | null;
  insuranceDocUrl: string | null;
  icaSignedAt: string | null;
  icaSignedIp: string | null;
  user: { name: string; email: string; avatarUrl: string | null; isVerified: boolean; stripeAccountStatus: string | null };
  checklist: Checklist;
};

const STEPS: { key: keyof Checklist; label: string }[] = [
  { key: "ica",             label: "ICA" },
  { key: "profile",         label: "Profile" },
  { key: "services",        label: "Services" },
  { key: "availability",    label: "Schedule" },
  { key: "backgroundCheck", label: "BG Check" },
  { key: "stripe",          label: "Stripe" },
];

const BG_COLORS: Record<string, string> = {
  PENDING:     "bg-slate-500/20 text-slate-400 border-slate-500/30",
  PAID:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_PROGRESS: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DEFERRED:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PASSED:      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  FAILED:      "bg-red-500/20 text-red-400 border-red-500/30",
};

function DocLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-tarea-sky hover:underline">
      <FileText className="w-3 h-3" /> {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

export default function AdminHandymenPage() {
  const [handymen, setHandymen] = useState<Handyman[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const filtered = handymen.filter(h => {
    const done = Object.values(h.checklist).filter(Boolean).length;
    if (filter === "COMPLETE") return done === 6;
    if (filter === "INCOMPLETE") return done < 6;
    if (filter === "PENDING_BG") return h.backgroundCheckStatus === "PENDING";
    if (filter === "NO_STRIPE") return h.user.stripeAccountStatus !== "active";
    return true;
  });

  const pendingBg = handymen.filter(h => h.backgroundCheckStatus === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Handymen</h1>
        <p className="text-slate-400 mt-1">Onboarding status and documents for every registered handyman</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: handymen.length, color: "text-white" },
          { label: "Fully set up", value: handymen.filter(h => Object.values(h.checklist).every(Boolean)).length, color: "text-emerald-400" },
          { label: "Incomplete setup", value: handymen.filter(h => !Object.values(h.checklist).every(Boolean)).length, color: "text-amber-400" },
          { label: "BG check pending", value: pendingBg, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ALL",        label: "All" },
          { key: "COMPLETE",   label: "✅ Complete" },
          { key: "INCOMPLETE", label: "⚠️ Incomplete" },
          { key: "PENDING_BG", label: "🔍 BG Pending" },
          { key: "NO_STRIPE",  label: "💳 No Stripe" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.key ? "bg-tarea-sky text-tarea-ink" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && <p className="text-slate-500 text-center py-10">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="text-slate-500 text-center py-10">No handymen found</p>}

        {!loading && filtered.map(h => {
          const completedCount = Object.values(h.checklist).filter(Boolean).length;
          const allDone = completedCount === 6;
          const isExpanded = expanded === h.id;

          return (
            <div key={h.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all">
              {/* Main row */}
              <div className="p-5 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-tarea-sky/20 flex items-center justify-center">
                  {h.user.avatarUrl
                    ? <img src={h.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="text-tarea-sky font-bold text-sm">{h.user.name[0]?.toUpperCase()}</span>}
                </div>

                {/* Name + email */}
                <div className="min-w-0 flex-shrink-0 w-48">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-semibold text-sm truncate">{h.user.name}</p>
                    {h.isPremium && <span className="text-[10px] font-bold bg-amber-400 text-tarea-ink px-1.5 py-0.5 rounded-full flex-shrink-0">PRO</span>}
                    {h.user.isVerified && <Shield className="w-3.5 h-3.5 text-tarea-sky flex-shrink-0" />}
                  </div>
                  <p className="text-slate-400 text-xs truncate">{h.user.email}</p>
                </div>

                {/* Checklist strip */}
                <div className="flex items-center gap-1.5 flex-1">
                  {STEPS.map(({ key, label }) => (
                    <div key={key} title={label}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold flex-shrink-0 ${
                        h.checklist[key]
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}>
                      {h.checklist[key]
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <XCircle className="w-3 h-3" />}
                      <span className="hidden xl:inline">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                <div className="flex-shrink-0 text-right w-16">
                  <p className={`text-lg font-black ${allDone ? "text-emerald-400" : "text-amber-400"}`}>
                    {completedCount}<span className="text-slate-500 text-sm font-normal">/6</span>
                  </p>
                </div>

                {/* Stats */}
                <div className="hidden lg:flex gap-4 flex-shrink-0 text-xs text-slate-400">
                  <span className="text-amber-400">⭐ {h.rating.toFixed(1)}</span>
                  <span>{h.totalJobs} jobs</span>
                  <span className="text-emerald-400">{formatCurrency(h.totalEarnings)}</span>
                </div>

                {/* BG status — inline dropdown */}
                <select
                  value={h.backgroundCheckStatus}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const res = await fetch("/api/admin/handymen", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ profileId: h.id, backgroundCheckStatus: newStatus }),
                    });
                    if (res.ok) {
                      toast.success(`BG check → ${newStatus}`);
                      setHandymen(prev => prev.map(x => x.id !== h.id ? x : { ...x, backgroundCheckStatus: newStatus }));
                    } else {
                      toast.error("Failed to update");
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer flex-shrink-0 ${BG_COLORS[h.backgroundCheckStatus] ?? BG_COLORS.PENDING} bg-transparent`}
                >
                  {["PENDING","DEFERRED","PAID","IN_PROGRESS","PASSED","FAILED"].map(s => (
                    <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                  ))}
                </select>

                {/* Expand toggle */}
                <button onClick={() => setExpanded(isExpanded ? null : h.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/10 px-5 py-4 grid md:grid-cols-2 gap-6">
                  {/* Documents */}
                  <div className="space-y-3">
                    <p className="text-white text-sm font-semibold">Documents</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gov ID Front</span>
                        <DocLink url={h.idFrontUrl} label="View" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gov ID Back</span>
                        <DocLink url={h.idBackUrl} label="View" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">License #</span>
                        <span className="text-white text-xs font-mono">{h.licenseNumber || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">License Doc</span>
                        <DocLink url={h.licenseDocUrl} label="View" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Insurance Cert</span>
                        <DocLink url={h.insuranceDocUrl} label="View" />
                      </div>
                    </div>
                  </div>

                  {/* ICA + Actions */}
                  <div className="space-y-3">
                    <p className="text-white text-sm font-semibold">ICA Signature</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Signed at</span>
                        <span className="text-white text-xs">
                          {h.icaSignedAt ? new Date(h.icaSignedAt).toLocaleString() : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">IP address</span>
                        <span className="text-white text-xs font-mono">{h.icaSignedIp || "—"}</span>
                      </div>
                    </div>

                    {h.verificationStatus === "pending" && (
                      <div className="pt-2 flex gap-2">
                        <button onClick={() => verify(h.id, "approve")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold transition-all">
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => verify(h.id, "reject")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-semibold transition-all">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
