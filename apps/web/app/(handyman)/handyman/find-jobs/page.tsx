"use client";

import { useState, useEffect } from "react";
import { cld } from "@/lib/cld";
import { MapPin, Clock, DollarSign, Loader2, Send, ChevronDown, ChevronUp, Zap, CheckCircle2, Lock, ChevronRight } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCurrency, formatDate, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import CategoryIcon from "@/components/ui/CategoryIcon";

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
  materialsCost: number;
  status: string;
  createdAt: string;
  imageUrls: string[];
  distanceKm: number | null;
  distanceMiles: number | null;
  score: number;
  customer: { name: string; city: string | null; avatarUrl: string | null };
  applications: { id: string }[];
};

type Checklist = {
  ica: boolean;
  profile: boolean;
  services: boolean;
  availability: boolean;
  backgroundCheck: boolean;
  stripe: boolean;
};

type Step = {
  key: keyof Checklist;
  label: string;
  desc: string;
  href: string;
  requires: keyof Checklist | null;
};

const STEPS: Step[] = [
  { key: "ica",             label: "Sign Contractor Agreement", desc: "Read and e-sign the Independent Contractor Agreement.",                     href: "/handyman/onboarding",     requires: null },
  { key: "profile",         label: "Complete Your Profile",      desc: "Add a profile photo, bio, and upload your government ID.",                   href: "/handyman/profile",        requires: "ica" },
  { key: "services",        label: "Add Your Services",           desc: "Select the services you offer with pricing and estimated duration.",          href: "/handyman/onboarding",     requires: "profile" },
  { key: "availability",    label: "Set Your Availability",       desc: "Choose the days and hours you're open to taking bookings.",                  href: "/handyman/schedule",       requires: "services" },
  { key: "backgroundCheck", label: "Complete Background Check",   desc: "One-time $29.99 check — required before you can receive job requests.",      href: "/handyman/onboarding",     requires: "availability" },
  { key: "stripe",          label: "Connect Stripe to Get Paid",  desc: "Link your bank account to receive payouts for completed jobs.",              href: "/handyman/payout-methods", requires: "backgroundCheck" },
];

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function ApplyForm({ jobId, defaultMaterials = 0, onApplied }: { jobId: string; defaultMaterials?: number; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [materials, setMaterials] = useState(defaultMaterials > 0 ? String(defaultMaterials) : "");
  const [sending, setSending] = useState(false);
  const { t } = useT();

  const submit = async () => {
    setSending(true);
    const res = await fetch(`/api/job-requests/${jobId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() || null, proposedPrice: proposedPrice || null, materialsEstimate: materials || null }),
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
      <div>
        <label className="label">Materials estimate ($)</label>
        <input type="number" min="0" value={materials} onChange={e => setMaterials(e.target.value)}
          placeholder="Cost of parts you'll supply"
          className="input" />
        <p className="text-[11px] text-gray-400 mt-1">Charged to the customer at cost (no fee). You'll provide receipts.</p>
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

function SetupChecklist({ checklist }: { checklist: Checklist }) {
  const completed = Object.values(checklist).filter(Boolean).length;
  const total = STEPS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-gray-900">Complete your setup to browse jobs</p>
            <p className="text-gray-500 text-sm mt-0.5">{completed} of {total} steps done</p>
          </div>
          <span className="text-2xl font-black text-gray-900">{completed}<span className="text-gray-400 text-lg font-normal">/{total}</span></span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct === 100 ? "#10B981" : "#F97316" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, index) => {
          const done = checklist[step.key];
          const locked = step.requires !== null && !checklist[step.requires];
          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                done    ? "bg-emerald-50 border-emerald-200" :
                locked  ? "bg-gray-50 border-gray-100 opacity-50" :
                          "bg-white border-orange-200 shadow-sm"
              }`}
            >
              {/* Step number / icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                done   ? "bg-emerald-500 text-white" :
                locked ? "bg-gray-200 text-gray-400" :
                         "bg-orange-500 text-white"
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : locked ? <Lock className="w-3.5 h-3.5" /> : index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${done ? "text-gray-400 line-through" : locked ? "text-gray-400" : "text-gray-900"}`}>
                  {step.label}
                </p>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{step.desc}</p>
              </div>

              {done ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full flex-shrink-0">Done</span>
              ) : locked ? (
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">Locked</span>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-full flex-shrink-0 transition-colors"
                >
                  Start <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FindJobsPage() {
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { t } = useT();

  useEffect(() => {
    Promise.all([
      fetch("/api/handyman/checklist").then(r => r.json()),
      fetch("/api/job-requests").then(r => r.json()),
    ]).then(([cl, jobsData]) => {
      setChecklist(cl);
      if (Array.isArray(jobsData)) setJobs(jobsData);
    }).finally(() => setLoading(false));
  }, []);

  const markApplied = (id: string) => {
    setApplied(prev => new Set(Array.from(prev).concat(id)));
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const setupDone = checklist
    ? Object.values(checklist).every(Boolean)
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">{t("page_find_jobs")}</h1>
        <p className="text-gray-500 mt-1">{t("page_find_jobs_sub")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
      ) : !setupDone && checklist ? (
        <SetupChecklist checklist={checklist} />
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
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CategoryIcon catKey={job.category} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-gray-900 font-bold">{job.title}</p>
                          <p className="text-gray-400 text-xs">{SERVICE_CATEGORY_LABELS[job.category]}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-orange-600 font-bold">{job.budgetMin === job.budgetMax ? formatCurrency(job.budgetMin) : `${formatCurrency(job.budgetMin)}–${formatCurrency(job.budgetMax)}`}</p>
                          <p className="text-gray-400 text-xs">{timeAgo(job.createdAt)}</p>
                        </div>
                      </div>

                      <p className={`text-gray-600 text-sm mt-2 ${isExpanded ? "" : "line-clamp-2"}`}>{job.description}</p>

                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-orange-400" />
                          {job.city}{job.distanceMiles !== null && ` · ${job.distanceMiles.toFixed(0)} mi away`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          {formatDate(new Date(job.scheduledAt))}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          {job.budgetMin === job.budgetMax ? formatCurrency(job.budgetMin) : `${formatCurrency(job.budgetMin)}–${formatCurrency(job.budgetMax)}`}
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
                          {job.imageUrls.map((url, idx) => (
                            <img key={idx} src={cld(url)} alt="" className="w-24 h-24 rounded-xl object-cover border border-orange-100" />
                          ))}
                        </div>
                      )}
                      <div className="bg-orange-50 rounded-xl p-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">Location</p>
                        <p>{job.address}, {job.city}</p>
                      </div>
                      {!alreadyApplied && (
                        <ApplyForm jobId={job.id} defaultMaterials={job.materialsCost} onApplied={() => markApplied(job.id)} />
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
