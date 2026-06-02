"use client";

import { useState, useEffect, useRef } from "react";

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
import { useSearchParams } from "next/navigation";
import { Loader2, Save, User, Phone, MapPin, LocateFixed, DollarSign, FileText, ToggleLeft, ToggleRight, Camera, Crown, Zap, Star, Shield, Building2, Globe, Lock } from "lucide-react";
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
  companyLogoUrl: string | null;
  ein: string | null;
  website: string | null;
  handymanProfile: {
    bio: string | null;
    hourlyRate: number;
    isAvailable: boolean;
    rating: number;
    totalJobs: number;
    idFrontUrl: string | null;
    idBackUrl: string | null;
    licenseNumber: string | null;
    licenseDocUrl: string | null;
    insuranceDocUrl: string | null;
  } | null;
};

export default function HandymanProfilePage() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", address: "", city: "", state: "", zipCode: "",
    bio: "", hourlyRate: "", isAvailable: true,
    companyName: "", ein: "", website: "",
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  // Document uploads
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const licenseDocRef = useRef<HTMLInputElement>(null);
  const insuranceDocRef = useRef<HTMLInputElement>(null);
  const [docUrls, setDocUrls] = useState({ idFrontUrl: "", idBackUrl: "", licenseNumber: "", licenseDocUrl: "", insuranceDocUrl: "" });
  const [docPreviews, setDocPreviews] = useState({ idFront: "", idBack: "", licenseDoc: "", insuranceDoc: "" });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const uploadDoc = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "tarea/id-docs");
    const res = await fetch("/api/upload/image", { method: "POST", body: form });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleDocFile = async (field: "idFront" | "idBack" | "licenseDoc" | "insuranceDoc", file: File) => {
    const reader = new FileReader();
    reader.onload = () => setDocPreviews(p => ({ ...p, [field]: reader.result as string }));
    reader.readAsDataURL(file);
    setUploadingDoc(true);
    const url = await uploadDoc(file);
    setUploadingDoc(false);
    if (!url) { toast.error("Upload failed"); return; }
    const keyMap = { idFront: "idFrontUrl", idBack: "idBackUrl", licenseDoc: "licenseDocUrl", insuranceDoc: "insuranceDocUrl" } as const;
    const urlKey = keyMap[field];
    const newUrls = { ...docUrls, [urlKey]: url };
    setDocUrls(newUrls);
    await fetch("/api/handyman/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [urlKey]: url }),
    });
    toast.success("Document saved!");
  };

  const saveLicenseNumber = async () => {
    await fetch("/api/handyman/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseNumber: docUrls.licenseNumber }),
    });
    toast.success("License number saved!");
  };

  const [sub, setSub] = useState<{ isPremium: boolean; stripeSubStatus: string | null } | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/subscription")
      .then(r => r.json())
      .then(d => setSub(d));

    const result = searchParams.get("sub");
    if (result === "success") toast.success("You're now a Tarea Pro member! 🎉");
    if (result === "cancel") toast("Subscription cancelled — you can upgrade anytime.", { icon: "ℹ️" });
  }, []);

  const startSubscription = async () => {
    setSubscribing(true);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.location.href = body.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setSubscribing(false);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm("Cancel your Tarea Pro subscription? You'll keep access until the end of the current billing period.")) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSub(s => s ? { ...s, stripeSubStatus: "canceling" } : s);
      toast.success("Subscription cancellation scheduled. You'll keep Pro access until the period ends.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

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
          bio: d.handymanProfile?.bio || "",
          hourlyRate: String(d.handymanProfile?.hourlyRate || ""),
          isAvailable: d.handymanProfile?.isAvailable ?? true,
          companyName: d.companyName || "",
          ein: d.ein || "",
          website: d.website || "",
        });
        setDocUrls({
          idFrontUrl: d.handymanProfile?.idFrontUrl || "",
          idBackUrl: d.handymanProfile?.idBackUrl || "",
          licenseNumber: d.handymanProfile?.licenseNumber || "",
          licenseDocUrl: d.handymanProfile?.licenseDocUrl || "",
          insuranceDocUrl: d.handymanProfile?.insuranceDocUrl || "",
        });
      });
  }, []);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

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
    if (!profile?.avatarUrl) { toast.error("Please upload a profile photo"); return; }
    if (!docUrls.idFrontUrl) { toast.error("Please upload the front of your government ID"); return; }
    if (!docUrls.idBackUrl) { toast.error("Please upload the back of your government ID"); return; }
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

      {/* Stats card */}
      <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-16 h-16 rounded-2xl bg-tarea-sky/20 flex items-center justify-center overflow-hidden group flex-shrink-0"
        >
          {uploading
            ? <Loader2 className="w-6 h-6 animate-spin text-tarea-sky" />
            : profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <User className="w-7 h-7 text-tarea-sky" />}
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
        <div className="flex-1">
          <p className="text-white font-bold">{profile.name}</p>
          <p className="text-slate-400 text-sm">{profile.email}</p>
          <div className="flex gap-3 mt-1.5 text-xs">
            <span className="text-amber-400">⭐ {profile.handymanProfile?.rating.toFixed(1) ?? "—"}</span>
            <span className="text-slate-400">{profile.handymanProfile?.totalJobs ?? 0} jobs</span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="text-slate-400 hover:text-tarea-sky transition-colors">
              Change photo
            </button>
          </div>
        </div>
        <button
          onClick={() => set("isAvailable", !form.isAvailable)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            form.isAvailable ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
          }`}
        >
          {form.isAvailable ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {form.isAvailable ? t("label_available") : t("label_unavailable")}
        </button>
      </div>

      {/* Premium subscription card */}
      {sub && (
        sub.isPremium ? (
          <div className="flex items-center gap-4 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <div className="w-12 h-12 bg-amber-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-amber-300 font-bold">Tarea Pro</p>
                <span className="text-[10px] font-bold bg-amber-400 text-tarea-ink px-2 py-0.5 rounded-full">
                  {sub.stripeSubStatus === "canceling" ? "CANCELING" : "ACTIVE"}
                </span>
              </div>
              <p className="text-amber-400/70 text-xs mt-0.5">Priority listing · Verified badge · Unlimited bids</p>
              {sub.stripeSubStatus === "canceling" && (
                <p className="text-amber-500/70 text-xs mt-1">Active until end of billing period</p>
              )}
            </div>
            {sub.stripeSubStatus !== "canceling" && (
              <button
                onClick={cancelSubscription}
                disabled={canceling}
                className="text-xs text-amber-500/70 hover:text-amber-400 underline underline-offset-2 disabled:opacity-50 transition-colors"
              >
                {canceling ? "Canceling…" : "Cancel"}
              </button>
            )}
          </div>
        ) : (
          <div className="p-5 bg-gradient-to-br from-tarea-sky/10 to-purple-500/10 border border-tarea-sky/20 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-tarea-sky/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6 text-tarea-sky" />
              </div>
              <div>
                <p className="text-white font-bold">Upgrade to Tarea Pro</p>
                <p className="text-slate-400 text-xs">$29/month — cancel anytime</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Star, text: "Priority in search results" },
                { icon: Shield, text: "Verified Pro badge" },
                { icon: Zap, text: "Unlimited job bids" },
                { icon: Crown, text: "Featured profile" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-tarea-sky flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>
            <button
              onClick={startSubscription}
              disabled={subscribing}
              className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-2.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50 text-sm"
            >
              {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {subscribing ? "Redirecting…" : "Upgrade to Pro — $29/mo"}
            </button>
          </div>
        )
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Profile picture */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-tarea-sky" /> Profile Picture <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all flex-shrink-0 group">
              {uploading
                ? <Loader2 className="w-6 h-6 animate-spin text-tarea-sky" />
                : profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1 text-slate-400"><Camera className="w-6 h-6" /><span className="text-xs">Upload</span></div>}
              <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </span>
            </button>
            <div className="text-sm text-slate-400 space-y-1">
              <p className="text-white font-medium">{profile.avatarUrl ? "Change your photo" : "Upload a profile photo"}</p>
              <p>A clear face photo helps customers trust you.</p>
              <p className="text-xs">JPG, PNG or WebP — max 5 MB</p>
            </div>
          </div>
        </div>

        {/* Personal info */}
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

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-tarea-sky" /> Hourly Rate ($)
          </label>
          <input type="number" min="0" value={form.hourlyRate} onChange={e => set("hourlyRate", e.target.value)} placeholder="75" className={field} />
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-tarea-sky" /> Bio
          </label>
          <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
            placeholder="Tell customers about your experience and skills…" rows={3}
            className={field + " resize-none"} />
        </div>

        {/* Company info — only shown for company accounts */}
        {profile.accountType === "COMPANY" && (
          <div className="border border-tarea-sky/20 rounded-xl p-4 space-y-3 bg-tarea-sky/5">
            <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-tarea-sky" /> Company Information
            </label>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Company name</label>
              <input value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Acme Services LLC" className={field} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">EIN / Tax ID</label>
              <input value={form.ein} onChange={e => set("ein", e.target.value)} placeholder="12-3456789" className={field} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" /> Website</label>
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

      {/* Documents */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-white font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-tarea-sky" /> Documents</h2>
          <p className="text-slate-500 text-xs mt-0.5">Upload your ID, license, and insurance documents. These are only visible to Tarea admins.</p>
        </div>

        {/* Gov ID */}
        <div>
          <p className="text-slate-300 text-sm font-medium mb-2">Government-Issued ID <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-2 gap-3">
            {(["idFront", "idBack"] as const).map((side) => {
              const ref = side === "idFront" ? idFrontRef : idBackRef;
              const preview = docPreviews[side];
              const existing = side === "idFront" ? docUrls.idFrontUrl : docUrls.idBackUrl;
              return (
                <div key={side}>
                  <p className="text-xs text-slate-400 mb-1.5">{side === "idFront" ? "Front (Recto)" : "Back (Verso)"}</p>
                  <button type="button" onClick={() => ref.current?.click()}
                    className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
                    {preview || existing ? (
                      <img src={preview || existing} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <FileText className="w-6 h-6" />
                        <span className="text-xs">{uploadingDoc ? "Uploading…" : "Upload"}</span>
                      </div>
                    )}
                  </button>
                  <input ref={ref} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleDocFile(side, f); e.target.value = ""; }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* License */}
        <div className="space-y-3">
          <p className="text-slate-300 text-sm font-medium">License</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={docUrls.licenseNumber}
              onChange={e => setDocUrls(d => ({ ...d, licenseNumber: e.target.value }))}
              placeholder="License number (e.g. CSLB-1234567)"
              className={field + " flex-1"}
            />
            <button onClick={saveLicenseNumber}
              className="px-4 py-2 bg-tarea-sky/15 border border-tarea-sky/30 text-tarea-sky rounded-xl text-sm font-semibold hover:bg-tarea-sky/25 transition-all">
              Save
            </button>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">License Document</p>
            <button type="button" onClick={() => licenseDocRef.current?.click()}
              className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
              {docPreviews.licenseDoc || docUrls.licenseDocUrl ? (
                <img src={docPreviews.licenseDoc || docUrls.licenseDocUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <FileText className="w-6 h-6" />
                  <span className="text-xs">{uploadingDoc ? "Uploading…" : "Upload license document"}</span>
                </div>
              )}
            </button>
            <input ref={licenseDocRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDocFile("licenseDoc", f); e.target.value = ""; }} />
          </div>
        </div>

        {/* Insurance */}
        <div>
          <p className="text-slate-300 text-sm font-medium mb-2">Insurance Certificate</p>
          <button type="button" onClick={() => insuranceDocRef.current?.click()}
            className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
            {docPreviews.insuranceDoc || docUrls.insuranceDocUrl ? (
              <img src={docPreviews.insuranceDoc || docUrls.insuranceDocUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <FileText className="w-6 h-6" />
                <span className="text-xs">{uploadingDoc ? "Uploading…" : "Upload insurance certificate"}</span>
              </div>
            )}
          </button>
          <input ref={insuranceDocRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleDocFile("insuranceDoc", f); e.target.value = ""; }} />
        </div>
      </div>

      {/* Notification preferences */}
      <NotifPrefs />
    </div>
  );
}
