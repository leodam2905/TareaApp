"use client";

import { useState, useRef, Suspense, useEffect } from "react";
import { cld } from "@/lib/cld";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, LocateFixed, Camera, X, Sparkles, DollarSign, Zap, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS);

const URGENCIES = [
  { value: "STANDARD", label: "Standard", desc: "Flexible timing" },
  { value: "SOON", label: "Soon", desc: "Within a few days" },
  { value: "URGENT", label: "Urgent", desc: "ASAP · within ~3h" },
];

// Local datetime for <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
const nowLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

function PostJobForm() {
  const router = useRouter();
  const { t } = useT();
  const params = useSearchParams();
  const presetCat = (params.get("category") || "").toUpperCase();
  // Seeded by AI Diagnose so the same problem is not described twice. The
  // guided questions still run — they are what makes the second estimate
  // firmer — but the customer's own words carry across.
  const presetDesc = params.get("description") || "";
  const presetDiagnosis = params.get("diagnosis") || "";
  const [estimate, setEstimate] = useState<{ price: number; urgency: number; isFixed: boolean; fee: number; total: number; feePct: number; materials: number; serviceTime: string; minutes: number | null; minimumNote: string | null; range: { low: number; high: number; proCount: number; single: boolean } | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  // The guided question set, same as the app's.
  //
  // This page used to be a free-text box and an "AI improve" button, so the
  // model was asked to price whatever prose someone happened to type, while
  // the app asked structured questions and priced the answers. Same job, two
  // different quality of inputs.
  const [tasks, setTasks] = useState<{ label: string; details: { key: string; label: string; options: string[] }[] }[]>([]);
  const [task, setTask] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiEstimating, setAiEstimating] = useState(false);
  const [priceNote, setPriceNote] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    category: CATEGORIES.includes(presetCat) ? presetCat : "PLUMBING",
    title: "",
    description: presetDesc,
    address: "",
    city: "",
    zip: "",
    scheduledAt: "",
    urgency: "STANDARD",
    budgetMin: "",
    budgetMax: "",
    latitude: "",
    longitude: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Urgent = ASAP: preselect now so the job lands in a ~3h window. Changing
  // urgency invalidates any prior estimate (price depends on it).
  const pickUrgency = (u: string) => {
    setForm(f => ({ ...f, urgency: u, ...(u === "URGENT" && !f.scheduledAt ? { scheduledAt: nowLocal() } : {}) }));
    setEstimate(null);
  };

  const uploadPhoto = async (file: File) => {
    if (imageUrls.length >= 4) { toast.error("Max 4 photos"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "tarea/job-requests");
    const res = await fetch("/api/upload/image", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setImageUrls(prev => [...prev, url]);
    } else {
      toast.error("Upload failed");
    }
    setUploading(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      set("latitude", String(latitude));
      set("longitude", String(longitude));
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { headers: { "Accept-Language": "en" } });
        const data = await res.json();
        const a = data.address || {};
        if (a.road) set("address", [a.house_number, a.road].filter(Boolean).join(" "));
        if (a.city || a.town) set("city", a.city || a.town);
        toast.success("Location detected!");
      } catch { toast.error("Could not detect location"); }
      setLocating(false);
    }, () => { toast.error("Location access denied"); setLocating(false); });
  };

  // Tasks follow the category. Changing category invalidates the task and its
  // answers — they belong to a question set that no longer applies.
  useEffect(() => {
    let cancelled = false;
    setTask(""); setAnswers({});
    if (!form.category) { setTasks([]); return; }
    fetch("/api/service-catalog")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const name = (d.categories ?? []).find((c: { api: string }) => c.api === form.category)?.name;
        setTasks(name ? (d.tasks?.[name] ?? []) : []);
      })
      .catch(() => setTasks([]));
    return () => { cancelled = true; };
  }, [form.category]);

  const currentTask = tasks.find((t) => t.label === task);
  const allAnswered = !!currentTask && currentTask.details.every((d) => answers[d.key]);

  /** The description the pricing model sees: the task and the answers to it. */
  const builtDescription = () => {
    if (!currentTask) return form.description;
    const parts = currentTask.details
      .filter((d) => answers[d.key])
      .map((d) => `${d.label}: ${answers[d.key]}`);
    const extra = form.description.trim();
    // The AI's read of the photo, when the customer came from Diagnose.
    // Attributed, so nobody mistakes it for something the customer asserted.
    const diag = presetDiagnosis ? ` [AI Diagnose: ${presetDiagnosis}]` : "";
    return `${currentTask.label}${parts.length ? ` (${parts.join(", ")})` : ""}${extra ? `. ${extra}` : ""}${diag}`;
  };

  const aiAssist = async () => {
    if (!form.description.trim()) { toast.error("Write a description first"); return; }
    setAiAssisting(true);
    const res = await fetch("/api/ai/job-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, rawDescription: form.description }),
    });
    if (res.ok) {
      const { title, description } = await res.json();
      if (title) set("title", title);
      if (description) set("description", description);
      toast.success("Description improved!");
    } else {
      toast.error("AI assist failed, try again");
    }
    setAiAssisting(false);
  };

  const aiEstimate = async () => {
    // Structured answers are the input now, so an unanswered question set is
    // what blocks an estimate — not an empty prose box.
    if (tasks.length > 0 && !allAnswered) { toast.error("Answer the questions above first"); return; }
    if (tasks.length === 0 && !form.description.trim()) { toast.error("Write a description first"); return; }
    setAiEstimating(true);
    const res = await fetch("/api/ai/price-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, description: builtDescription(), city: `${form.city} ${form.zip}`.trim(), urgent: form.urgency === "URGENT" }),
    });
    if (res.ok) {
      const d = await res.json();
      // Exact single price (AI fixed price, else range midpoint).
      const price = d.price ?? (d.min != null && d.max != null ? Math.round((d.min + d.max) / 2) : null);
      if (price != null) { set("budgetMin", String(price)); set("budgetMax", String(price)); }
      setEstimate({
        price: price ?? 0,
        urgency: d.breakdown?.urgency ?? 0,
        isFixed: !!d.isFixed,
        fee: d.serviceFee ?? 0,
        total: d.total ?? (price ?? 0),
        feePct: Math.round((d.feeRate ?? 0.15) * 100),
        materials: d.materials ?? d.breakdown?.materials ?? 0,
        // Tarea AI's single estimated billable time — what the price is built
        // from. Falls back to the legacy hours range on an older server.
        serviceTime: (d.estimatedServiceTime ?? d.workTime ?? "") as string,
        minutes: (d.estimatedBillableMinutes ?? null) as number | null,
        // A bill longer than the estimate needs its reason stated — the
        // customer is being asked to rely on this number.
        minimumNote: d.minimumApplied && d.minimumMinutes
          ? `Billed at this pro's ${Math.round(d.minimumMinutes / 60)}h minimum`
          : null,
        // The spread of what pros actually charge. Tarea does not set this
        // price — the customer picks a pro and that pro's rate decides it.
        range: d.priceRange ?? null,
      });
      setPriceNote(d.note || "");
    } else {
      toast.error("Could not estimate price");
    }
    setAiEstimating(false);
  };

  const submit = async () => {
    // description is no longer typed by hand — builtDescription() composes it
    // from the task and answers, so requiring the raw box would block a fully
    // answered form.
    if (!form.title || !form.address || !form.city || !form.zip || !form.scheduledAt || !form.budgetMin || !form.budgetMax) {
      toast.error("Please fill in all required fields"); return;
    }
    setSaving(true);
    const res = await fetch("/api/job-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        // The task and its answers, so a pro reads the same detail the price
        // was based on rather than an empty box.
        description: builtDescription(),
        address: form.zip ? `${form.address}, ${form.zip}` : form.address,
        // Zero on purpose: the pro quotes materials when they apply, and that
        // quote is what the customer is charged.
        materialsCost: 0,
        // Every applicant is quoted on these minutes at their own rate, so the
        // customer's comparison between them is like-for-like.
        ...(estimate?.minutes ? { estimatedBillableMinutes: estimate.minutes } : {}),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        imageUrls,
      }),
    });
    if (res.ok) {
      toast.success("Job posted! Handymen near you will be notified.");
      router.push("/customer/requests");
    } else {
      const b = await res.json();
      toast.error(b.error || "Failed to post job");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">{t("page_post_job")}</h1>
        <p className="text-gray-500 mt-1">{t("page_post_job_sub")}</p>
      </div>

      <div className="bg-white border border-orange-100 rounded-2xl p-6 space-y-5 shadow-sm">
        {/* Category */}
        <div>
          <label className="label">Category <span className="text-red-400">*</span></label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className="input">
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className="label">How soon? <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            {URGENCIES.map(u => {
              const sel = form.urgency === u.value;
              return (
                <button key={u.value} type="button" onClick={() => pickUrgency(u.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${sel ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-orange-300"}`}>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    {u.value === "URGENT" ? <Zap className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-orange-500" />}
                    {u.label}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{u.desc}</div>
                </button>
              );
            })}
          </div>
          {form.urgency === "URGENT" && (
            <p className="text-xs font-semibold text-red-600 mt-2 flex items-center gap-1">
              <Zap className="w-3 h-3 flex-shrink-0" /> A pro aims to arrive within ~3 hours. We set the earliest time — you can adjust it.
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="label">Job Title <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Fix leaking kitchen pipe" className="input" />
        </div>

        {/* What the job is — the same guided questions the app asks.
            Structured answers, not prose: the pricing model is given "Fix Leaky
            Faucet (Location: Kitchen, Parts supplied by: Handyman)" instead of
            whatever somebody typed, which is why the app's estimates were the
            better ones. */}
        {tasks.length > 0 && (
          <div>
            <label className="label">What do you need? <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {tasks.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => { setTask(t.label); setAnswers({}); }}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    task === t.label
                      ? "bg-tarea-sky text-tarea-ink border-tarea-sky"
                      : "border-[var(--card-border-2)] hover:border-tarea-sky"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentTask && currentTask.details.map((d) => (
          <div key={d.key}>
            <label className="label">{d.label} <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {d.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [d.key]: o }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    answers[d.key] === o
                      ? "bg-tarea-sky text-tarea-ink border-tarea-sky font-semibold"
                      : "border-[var(--card-border-2)] hover:border-tarea-sky"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Anything else. Optional now that the questions carry the detail —
            it used to be the only input and therefore mandatory. */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">
              Anything else? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <button type="button" onClick={aiAssist} disabled={aiAssisting || !form.description.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40 transition-colors">
              {aiAssisting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiAssisting ? "Improving…" : "AI improve"}
            </button>
          </div>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Anything the questions above didn't cover…"
            rows={3}
            className="input resize-none"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="label">Photos <span className="text-gray-400 font-normal">(optional, max 4)</span></label>
          <div className="flex flex-wrap gap-3">
            {imageUrls.map((url, i) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-orange-200">
                <img src={cld(url)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {imageUrls.length < 4 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-orange-300 flex flex-col items-center justify-center gap-1 text-orange-400 hover:border-orange-400 hover:bg-orange-50 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <span className="text-xs font-medium">{uploading ? "Uploading" : "Add photo"}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
          />
        </div>

        {/* Location */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" /> Location <span className="text-red-400">*</span>
            </label>
            <button type="button" onClick={detectLocation} disabled={locating}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              {locating ? "Detecting…" : "Use my location"}
            </button>
          </div>
          <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" className="input" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" className="input" />
            <input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="ZIP code" inputMode="numeric" className="input" />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="label">When do you need it? <span className="text-red-400">*</span></label>
          <input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} className="input" />
        </div>

        {/* Budget */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Budget ($) <span className="text-red-400">*</span></label>
            <button type="button" onClick={aiEstimate} disabled={aiEstimating || !form.description.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40 transition-colors">
              {aiEstimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
              {aiEstimating ? "Estimating…" : "AI estimate"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0" value={form.budgetMin} onChange={e => set("budgetMin", e.target.value)} placeholder="Min (e.g. 50)" className="input" />
            <input type="number" min="0" value={form.budgetMax} onChange={e => set("budgetMax", e.target.value)} placeholder="Max (e.g. 200)" className="input" />
          </div>
          {estimate && (
            <div className="mt-3 rounded-xl bg-orange-50/60 border border-orange-100 p-3 space-y-1.5 text-sm">
              {estimate.serviceTime && (
                <div className="flex justify-between text-gray-600"><span>Tarea AI Estimated Service Time</span><span>{estimate.serviceTime}</span></div>
              )}
              {estimate.minimumNote && (
                <p className="text-[11px] text-gray-500 -mt-1">{estimate.minimumNote}</p>
              )}
              <div className="flex justify-between text-gray-600"><span>Service price</span><span>${estimate.price}</span></div>
              {estimate.urgency > 0 && (
                <div className="flex justify-between text-red-600 font-semibold"><span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Urgent rush fee</span><span>+${estimate.urgency}</span></div>
              )}
              {estimate.materials > 0 && (
                <div className="flex justify-between text-gray-600"><span>Materials (at cost)</span><span>${estimate.materials}</span></div>
              )}
              <div className="flex justify-between text-gray-600"><span>Service Fee ({estimate.feePct}%)</span><span>${estimate.fee}</span></div>
              {estimate.range && !estimate.range.single ? (
                <>
                  <div className="flex justify-between font-extrabold text-gray-900 pt-1.5 border-t border-orange-100">
                    <span>Estimated total</span>
                    <span>${estimate.range.low}–${estimate.range.high}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 pt-1">
                    Across {estimate.range.proCount} pros. Pros set their own rates — your final price depends on which pro you choose.
                  </p>
                </>
              ) : (
                <div className="flex justify-between font-extrabold text-gray-900 pt-1.5 border-t border-orange-100"><span>{estimate.isFixed ? "Total (fixed)" : "Estimated total"}</span><span>${estimate.total}</span></div>
              )}
              {estimate.materials > 0 && (
                <p className="text-[11px] text-gray-500 pt-1">Materials is a suggested estimate — your pro confirms the actual cost (with receipts) when they apply.</p>
              )}
            </div>
          )}
          {priceNote && (
            <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> {priceNote}
            </p>
          )}
        </div>

        <button
          onClick={submit}
          disabled={saving}
          style={{
            backgroundColor: "#1E3A8A",
            color: "#ffffff",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontWeight: 700,
            fontSize: "16px",
            padding: "14px 24px",
            borderRadius: "12px",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.85 : 1,
            marginTop: "24px",
          }}
        >
          {saving && <Loader2 style={{ color: "#ffffff", width: 18, height: 18 }} className="animate-spin" />}
          <span style={{ color: "#ffffff" }}>{saving ? t("btn_posting") : t("btn_post_job")}</span>
        </button>
      </div>
    </div>
  );
}

export default function PostJobPage() {
  return (
    <Suspense fallback={null}>
      <PostJobForm />
    </Suspense>
  );
}
