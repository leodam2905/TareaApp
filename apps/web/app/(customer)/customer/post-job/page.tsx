"use client";

import { useState, useRef, Suspense } from "react";
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
  const presetCat = (useSearchParams().get("category") || "").toUpperCase();
  const [estimate, setEstimate] = useState<{ price: number; urgency: number; isFixed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [priceNote, setPriceNote] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    category: CATEGORIES.includes(presetCat) ? presetCat : "PLUMBING",
    title: "",
    description: "",
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
    if (!form.description.trim()) { toast.error("Write a description first"); return; }
    setAiEstimating(true);
    const res = await fetch("/api/ai/price-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, description: form.description, city: `${form.city} ${form.zip}`.trim(), urgent: form.urgency === "URGENT" }),
    });
    if (res.ok) {
      const d = await res.json();
      // Exact single price (AI fixed price, else range midpoint).
      const price = d.price ?? (d.min != null && d.max != null ? Math.round((d.min + d.max) / 2) : null);
      if (price != null) { set("budgetMin", String(price)); set("budgetMax", String(price)); }
      setEstimate({ price: price ?? 0, urgency: d.breakdown?.urgency ?? 0, isFixed: !!d.isFixed });
      setPriceNote(d.note || "");
    } else {
      toast.error("Could not estimate price");
    }
    setAiEstimating(false);
  };

  const submit = async () => {
    if (!form.title || !form.description || !form.address || !form.city || !form.zip || !form.scheduledAt || !form.budgetMin || !form.budgetMax) {
      toast.error("Please fill in all required fields"); return;
    }
    setSaving(true);
    const res = await fetch("/api/job-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, address: form.zip ? `${form.address}, ${form.zip}` : form.address, scheduledAt: new Date(form.scheduledAt).toISOString(), imageUrls }),
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

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Description <span className="text-red-400">*</span></label>
            <button type="button" onClick={aiAssist} disabled={aiAssisting || !form.description.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40 transition-colors">
              {aiAssisting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiAssisting ? "Improving…" : "AI improve"}
            </button>
          </div>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Describe the problem in detail — what's broken, how long it's been an issue, any relevant details…"
            rows={4}
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
            <p className="text-sm font-bold text-gray-900 mt-2">
              {estimate.isFixed ? "Fixed price" : "Estimated price"}: ${estimate.price}
            </p>
          )}
          {estimate && estimate.urgency > 0 && (
            <p className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 flex-shrink-0" /> Includes urgent rush fee +${estimate.urgency}
            </p>
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
