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

  const field = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">{t("page_post_job")}</h1>
        <p className="text-slate-400 mt-1">{t("page_post_job_sub")}</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Category */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Category <span className="text-red-400">*</span></label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className={field}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{SERVICE_CATEGORY_ICONS[c]} {SERVICE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Job Title <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Fix leaking kitchen pipe" className={field} />
        </div>

        {/* Description */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Description <span className="text-red-400">*</span></label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="Describe the problem in detail…" rows={4}
            className={field + " resize-none"} />
        </div>

        {/* Location */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-tarea-sky" /> Location <span className="text-red-400">*</span>
            </label>
            <button type="button" onClick={detectLocation} disabled={locating}
              className="flex items-center gap-1.5 text-xs font-semibold text-tarea-sky hover:text-sky-400 transition-colors disabled:opacity-50">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              {locating ? "Detecting…" : "Use my location"}
            </button>
          </div>
          <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" className={field} />
          <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" className={field} />
        </div>

        {/* Date */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">When do you need it? <span className="text-red-400">*</span></label>
          <input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} className={field} />
        </div>

        {/* Budget */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">Min Budget ($) <span className="text-red-400">*</span></label>
            <input type="number" min="0" value={form.budgetMin} onChange={e => set("budgetMin", e.target.value)} placeholder="50" className={field} />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">Max Budget ($) <span className="text-red-400">*</span></label>
            <input type="number" min="0" value={form.budgetMax} onChange={e => set("budgetMax", e.target.value)} placeholder="200" className={field} />
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("btn_posting") : t("btn_post_job")}
        </button>
      </div>
    </div>
  );
}
