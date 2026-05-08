"use client";

import { useState, useEffect } from "react";
import { Star, MapPin, Clock, CheckCircle2, XCircle, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatCurrency, formatDate, SERVICE_CATEGORY_ICONS, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

type Application = {
  id: string;
  status: string;
  message: string | null;
  proposedPrice: number | null;
  createdAt: string;
  user: { name: string; avatarUrl: string | null };
  handyman: { rating: number; totalJobs: number; bio: string | null };
};

type JobRequest = {
  id: string;
  category: string;
  title: string;
  description: string;
  city: string;
  scheduledAt: string;
  budgetMin: number;
  budgetMax: number;
  status: string;
  imageUrls: string[];
  createdAt: string;
  applications: Application[];
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-orange-100 text-orange-600",
  ASSIGNED: "bg-emerald-100 text-emerald-600",
  CLOSED: "bg-gray-100 text-gray-500",
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/job-requests").then(r => r.json()).then(d => { if (Array.isArray(d)) setRequests(d); setLoading(false); });
  }, []);

  const act = async (jobId: string, appId: string, action: "accept" | "reject") => {
    setActing(appId);
    const res = await fetch(`/api/job-requests/${jobId}/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success(action === "accept" ? t("status_accepted") + "!" : t("btn_decline"));
      setRequests(prev => prev.map(r => {
        if (r.id !== jobId) return r;
        return {
          ...r,
          status: action === "accept" ? "ASSIGNED" : r.status,
          applications: r.applications.map(a =>
            a.id === appId ? { ...a, status: action === "accept" ? "ACCEPTED" : "REJECTED" }
              : action === "accept" ? { ...a, status: "REJECTED" } : a
          ),
        };
      }));
    } else {
      toast.error("Action failed");
    }
    setActing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">{t("page_requests")}</h1>
          <p className="text-gray-500 mt-1">{t("page_requests_sub")}</p>
        </div>
        <Link href="/customer/post-job"
          className="flex items-center gap-2 btn-primary transition-all text-sm">
          <Plus className="w-4 h-4" /> {t("nav_post_job")}
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-orange-100 rounded-2xl p-16 text-center shadow-sm space-y-4">
          <p className="text-gray-500">{t("empty_requests")}</p>
          <Link href="/customer/post-job" className="btn-secondary inline-block">{t("btn_post_first")}</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {requests.map(r => (
            <div key={r.id} className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
              {/* Job header */}
              <div className="p-5 flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="text-2xl mt-0.5">{SERVICE_CATEGORY_ICONS[r.category] || "🛠️"}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-900 font-bold">{r.title}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{SERVICE_CATEGORY_LABELS[r.category]}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.city}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(new Date(r.scheduledAt))}</span>
                      <span className="text-tarea-sky font-semibold">{formatCurrency(r.budgetMin)}–{formatCurrency(r.budgetMax)}</span>
                      <span className="text-slate-600">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-gray-900 font-bold text-lg">{r.applications.length}</p>
                  <p className="text-gray-400 text-xs">{r.applications.length === 1 ? t("label_applicants", { n: r.applications.length }) : t("label_applicants_plural", { n: r.applications.length })}</p>
                </div>
              </div>

              {/* Photos */}
              {r.imageUrls?.length > 0 && (
                <div className="px-5 pb-3 flex gap-2">
                  {r.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-orange-100" />
                  ))}
                </div>
              )}

              {/* Applications */}
              {r.applications.length > 0 && (
                <div className="border-t border-orange-100 divide-y divide-orange-50">
                  {r.applications.map(a => (
                    <div key={a.id} className={`p-4 flex items-center gap-4 ${a.status === "ACCEPTED" ? "bg-emerald-500/5" : a.status === "REJECTED" ? "opacity-50" : ""}`}>
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {a.user.avatarUrl
                          ? <img src={a.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          : <span className="text-orange-600 font-bold">{a.user.name[0]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-gray-900 font-semibold text-sm">{a.user.name}</p>
                          <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                            <Star className="w-3 h-3 fill-current" />{a.handyman.rating.toFixed(1)}
                          </span>
                          <span className="text-slate-500 text-xs">{a.handyman.totalJobs} jobs</span>
                        </div>
                        {a.message && <p className="text-gray-500 text-xs mt-0.5 truncate">"{a.message}"</p>}
                        {a.proposedPrice && (
                          <p className="text-orange-500 text-xs font-semibold mt-0.5">Offers: {formatCurrency(a.proposedPrice)}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {a.status === "ACCEPTED" && (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Accepted
                          </span>
                        )}
                        {a.status === "REJECTED" && (
                          <span className="text-slate-500 text-xs">Rejected</span>
                        )}
                        {a.status === "PENDING" && r.status === "OPEN" && (
                          <div className="flex gap-2">
                            <button onClick={() => act(r.id, a.id, "reject")} disabled={acting === a.id}
                              className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50">
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => act(r.id, a.id, "accept")} disabled={acting === a.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-all disabled:opacity-50">
                              {acting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Accept"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
