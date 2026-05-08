"use client";

import { useState, useEffect } from "react";
import { MapPin, Clock, DollarSign, Loader2, Send, ChevronDown, ChevronUp, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, formatDate, SERVICE_CATEGORY_ICONS, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

type JobRequest = {
  id: string;
  category: string;
  title: string;
  description: string;
  city: string;
  address: string;
  scheduledAt: string;
  budgetMin: number;
  budgetMax: number;
  status: string;
  createdAt: string;
  imageUrls: string[];
  distanceKm: number | null;
  score: number;
  customer: { name: string; city: string | null; avatarUrl: string | null };
  applications: { id: string }[];
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function ApplyForm({ jobId, onApplied }: { jobId: string; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [sending, setSending] = useState(false);
  const { t } = useT();

  const submit = async () => {
    setSending(true);
    const res = await fetch(`/api/job-requests/${jobId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() || null, proposedPrice: proposedPrice || null }),
    });
    if (res.ok) {
      toast.success(t("toast_applied"));
      onApplied();
    } else {
      const b = await res.json();
      toast.error(b.error || "Failed to apply");
    }
    setSending(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 text-sm">
        <Send className="w-4 h-4" /> {t("btn_apply_job")}
      </button>
    );
  }

  return (
    <div className="space-y-3 border-t border-orange-100 pt-4">
      <div>
        <label className="label">Your message (optional)</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Briefly describe your approach or experience with this type of job…"
          rows={2}
          className="input resize-none" />
      </div>
      <div>
        <label className="label">Your price offer ($) (optional)</label>
        <input type="number" min="0" value={proposedPrice} onChange={e => setProposedPrice(e.target.value)}
          placeholder="Leave blank to accept customer's budget"
          className="input" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-xl border border-orange-200 text-gray-500 hover:text-gray-900 transition-all text-sm">
          {t("btn_cancel")}
        </button>
        <button onClick={submit} disabled={sending}
          className="flex-1 flex items-center justify-center gap-2 btn-primary py-2 text-sm disabled:opacity-50">
          {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {sending ? t("btn_sending") : t("btn_send_app")}
        </button>
      </div>
    </div>
  );
}

export default function FindJobsPage() {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { t } = useT();

  useEffect(() => {
    fetch("/api/job-requests")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setJobs(d); setLoading(false); });
  }, []);

  const markApplied = (id: string) => {
    setApplied(prev => new Set(Array.from(prev).concat(id)));
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">{t("page_find_jobs")}</h1>
        <p className="text-gray-500 mt-1">{t("page_find_jobs_sub")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-orange-100 rounded-2xl p-16 text-center space-y-3 shadow-sm">
          <p className="text-3xl">🎉</p>
          <p className="text-gray-900 font-semibold">{t("all_caught_up")}</p>
          <p className="text-gray-500 text-sm">{t("empty_find_jobs")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job, i) => {
            const isExpanded = expanded === job.id;
            const alreadyApplied = applied.has(job.id);
            return (
              <div key={job.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${i === 0 ? "border-orange-300 ring-1 ring-orange-200" : "border-orange-100"}`}>
                <div className="p-5">
                  {i === 0 && (
                    <div className="mb-3">
                      <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        ⭐ Best match
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 flex-shrink-0">{SERVICE_CATEGORY_ICONS[job.category] || "🛠️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-gray-900 font-bold">{job.title}</p>
                          <p className="text-gray-400 text-xs">{SERVICE_CATEGORY_LABELS[job.category]}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-orange-600 font-bold">{formatCurrency(job.budgetMin)}–{formatCurrency(job.budgetMax)}</p>
                          <p className="text-gray-400 text-xs">{timeAgo(job.createdAt)}</p>
                        </div>
                      </div>

                      <p className={`text-gray-600 text-sm mt-2 ${isExpanded ? "" : "line-clamp-2"}`}>{job.description}</p>

                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-orange-400" />
                          {job.city}
                          {job.distanceKm !== null && ` · ${job.distanceKm.toFixed(0)} km away`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          {formatDate(new Date(job.scheduledAt))}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          {formatCurrency(job.budgetMin)}–{formatCurrency(job.budgetMax)}
                        </span>
                        {job.applications.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            {job.applications.length} applied
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setExpanded(isExpanded ? null : job.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-200 text-gray-500 hover:text-gray-900 transition-all text-xs font-medium">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? "Less" : "Details"}
                    </button>
                    {!alreadyApplied && !isExpanded && (
                      <button onClick={() => setExpanded(job.id)}
                        className="flex-1 flex items-center justify-center gap-2 btn-primary py-2 text-sm">
                        <Send className="w-4 h-4" /> {t("btn_apply")}
                      </button>
                    )}
                    {alreadyApplied && (
                      <span className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 border border-emerald-200 font-semibold py-2 rounded-xl text-sm">
                        ✓ Applied
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {job.imageUrls?.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {job.imageUrls.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover border border-orange-100" />
                          ))}
                        </div>
                      )}
                      <div className="bg-orange-50 rounded-xl p-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">Location</p>
                        <p>{job.address}, {job.city}</p>
                      </div>
                      {!alreadyApplied && (
                        <ApplyForm jobId={job.id} onApplied={() => markApplied(job.id)} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
