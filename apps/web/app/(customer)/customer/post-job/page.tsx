"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LocateFixed, Camera, X, Sparkles, DollarSign } from "lucide-react";
import toast from "react-hot-toast";
import { SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS);

export default function PostJobPage() {
  const router = useRouter();
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [priceNote, setPriceNote] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    category: "PLUMBING",
    title: "",
    description: "",
    address: "",
    city: "",
    scheduledAt: "",
    budgetMin: "",
    budgetMax: "",
    latitude: "",
    longitude: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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
      body: JSON.stringify({ category: form.category, description: form.description, city: form.city }),
    });
    if (res.ok) {
      const { min, max, note } = await res.json();
      set("budgetMin", String(min));
      set("budgetMax", String(max));
      setPriceNote(note);
    } else {
      toast.error("Could not estimate price");
    }
    setAiEstimating(false);
  };

  const submit = async () => {
    if (!form.title || !form.description || !form.address || !form.city || !form.scheduledAt || !form.budgetMin || !form.budgetMax) {
      toast.error("Please fill in all required fields"); return;
    }
    setSaving(true);
    const res = await fetch("/api/job-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), imageUrls }),
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
                <img src={url} alt="" className="w-full h-full object-cover" />
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
          <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" className="input" />
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
          {priceNote && (
            <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> {priceNote}
            </p>
          )}
        </div>

        <button onClick={submit} disabled={saving}
          style={{ color: "#fff" }}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#fff" }} />}
          <span style={{ color: "#fff" }}>{saving ? t("btn_posting") : t("btn_post_job")}</span>
        </button>
      </div>
    </div>
  );
}
