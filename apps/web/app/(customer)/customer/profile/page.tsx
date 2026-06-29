"use client";

import { useState, useEffect, useRef } from "react";
import { cld } from "@/lib/cld";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["DC","Washington D.C."],
] as const;
import { Loader2, Save, User, Phone, MapPin, LocateFixed, Camera, Building2, Globe, Lock } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useT } from "@/contexts/LanguageContext";
import NotifPrefs from "@/components/ui/NotifPrefs";

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  avatarUrl: string | null;
  accountType: string;
  companyName: string | null;
  ein: string | null;
  website: string | null;
};

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", city: "", state: "", zipCode: "", companyName: "", ein: "", website: "" });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setForm({
          name: d.name || "",
          phone: d.phone || "",
          address: d.address || "",
          city: d.city || "",
          state: d.state || "",
          zipCode: d.zipCode || "",
          companyName: d.companyName || "",
          ein: d.ein || "",
          website: d.website || "",
        });
      });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setProfile(p => p ? { ...p, avatarUrl: data.url } : p);
      toast.success("Photo updated!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const a = data.address || {};
        if (a.road) set("address", [a.house_number, a.road].filter(Boolean).join(" "));
        if (a.city || a.town) set("city", a.city || a.town);
        if (a.state) set("state", a.state);
        if (a.postcode) set("zipCode", a.postcode);
        toast.success("Location detected!");
      } catch { toast.error("Could not detect location"); }
      setLocating(false);
    }, () => { toast.error("Location access denied"); setLocating(false); });
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) toast.success(t("toast_profile_saved"));
    else toast.error("Failed to save");
    setSaving(false);
  };

  const field = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky";

  if (!profile) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">{t("page_profile")}</h1>
        <p className="text-slate-400 mt-1">{t("page_profile_sub")}</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-16 h-16 rounded-2xl bg-tarea-sky/20 flex items-center justify-center text-2xl font-bold text-tarea-sky overflow-hidden group flex-shrink-0"
        >
          {uploading
            ? <Loader2 className="w-6 h-6 animate-spin text-tarea-sky" />
            : profile.avatarUrl
              ? <img src={cld(profile.avatarUrl)} alt="" className="w-full h-full object-cover" />
              : <User className="w-7 h-7" />}
          <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
            <Camera className="w-5 h-5 text-white" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
        />
        <div>
          <p className="text-white font-bold">{profile.name}</p>
          <p className="text-slate-400 text-sm">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-tarea-sky/20 text-tarea-sky px-2 py-0.5 rounded-full font-semibold">CUSTOMER</span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="text-xs text-slate-400 hover:text-tarea-sky transition-colors">
              Change photo
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-2">
            <User className="w-4 h-4 text-tarea-sky" /> Full Name
          </label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" className={field} />
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-2">
            <Phone className="w-4 h-4 text-tarea-sky" /> Phone
          </label>
          <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" className={field} />
        </div>

        {profile.accountType === "COMPANY" && (
          <div className="border border-tarea-sky/20 rounded-xl p-4 space-y-3 bg-tarea-sky/5">
            <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-tarea-sky" /> Company Information
            </label>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Company name</label>
              <input value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Acme Corp LLC" className={field} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">EIN / Tax ID</label>
              <input value={form.ein} onChange={e => set("ein", e.target.value)} placeholder="12-3456789" className={field} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Website</label>
              <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://yourcompany.com" className={field} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-tarea-sky" /> Location
            </label>
            <button onClick={detectLocation} disabled={locating}
              className="flex items-center gap-1.5 text-xs font-semibold text-tarea-sky hover:text-sky-400 transition-colors disabled:opacity-50">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              {locating ? "Detecting…" : "Use my location"}
            </button>
          </div>
          <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" className={field} />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" className={field} />
            <select value={form.state} onChange={e => set("state", e.target.value)} className={field}>
              <option value="">Select state</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <input value={form.zipCode} onChange={e => set("zipCode", e.target.value)} placeholder="ZIP Code" className={field} />
        </div>

        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t("btn_saving") : t("btn_save")}
        </button>

        <Link href="/account/change-password"
          className="w-full flex items-center justify-center gap-2 border border-tarea-border text-tarea-ink-muted py-3 rounded-xl hover:border-tarea-sky hover:text-tarea-sky transition-all text-sm font-semibold">
          <Lock className="w-4 h-4" /> Change Password
        </Link>
      </div>

      <NotifPrefs />
    </div>
  );
}
