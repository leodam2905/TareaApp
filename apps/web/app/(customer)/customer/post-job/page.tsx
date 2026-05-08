"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, LocateFixed } from "lucide-react";
import toast from "react-hot-toast";
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_ICONS } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS);

export default function PostJobPage() {
  const router = useRouter();
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
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

  const submit = async () => {
    if (!form.title || !form.description || !form.address || !form.city || !form.scheduledAt || !form.budgetMin || !form.budgetMax) {
      toast.error("Please fill in all required fields"); return;
    }
    setSaving(true);
    const res = await fetch("/api/job-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }),
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
              <option key={c} value={c}>{SERVICE_CATEGORY_ICONS[c]} {SERVICE_CATEGORY_LABELS[c]}</option>
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
          <label className="label">Description <span className="text-red-400">*</span></label>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Describe the problem in detail — what's broken, how long it's been an issue, any relevant details…"
            rows={4}
            className="input resize-none"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Min Budget ($) <span className="text-red-400">*</span></label>
            <input type="number" min="0" value={form.budgetMin} onChange={e => set("budgetMin", e.target.value)} placeholder="50" className="input" />
          </div>
          <div>
            <label className="label">Max Budget ($) <span className="text-red-400">*</span></label>
            <input type="number" min="0" value={form.budgetMax} onChange={e => set("budgetMax", e.target.value)} placeholder="200" className="input" />
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("btn_posting") : t("btn_post_job")}
        </button>
      </div>
    </div>
  );
}
