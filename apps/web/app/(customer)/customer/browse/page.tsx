"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Calendar, Star, Clock, Zap, ArrowLeft, Loader2, List, Map, ShieldCheck, Building2, Camera, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

const HandymenMap = dynamic(() => import("@/components/ui/HandymenMap"), { ssr: false });

const CATEGORIES = [
  { key: "PLUMBING",         label: "Plumbing",         desc: "Pipes, leaks, faucets",       emoji: "🔧" },
  { key: "ELECTRICAL",       label: "Electrical",       desc: "Wiring, outlets, lighting",    emoji: "⚡" },
  { key: "CARPENTRY",        label: "Carpentry",        desc: "Furniture, doors, framing",    emoji: "🔨" },
  { key: "PAINTING",         label: "Painting",         desc: "Interior & exterior",          emoji: "🎨" },
  { key: "CLEANING",         label: "Cleaning",         desc: "Deep clean, move-in/out",      emoji: "🧹" },
  { key: "HVAC",             label: "HVAC",             desc: "AC, heating, ventilation",     emoji: "❄️" },
  { key: "ROOFING",          label: "Roofing",          desc: "Repairs, gutters",             emoji: "🏠" },
  { key: "LANDSCAPING",      label: "Landscaping",      desc: "Lawn, trimming, planting",     emoji: "🌿" },
  { key: "MOVING",           label: "Moving",           desc: "Packing, hauling",             emoji: "📦" },
  { key: "APPLIANCE_REPAIR",   label: "Appliances",        desc: "Washer, fridge, dryer",       emoji: "🔌" },
  { key: "WASH_AND_FOLD",     label: "Wash & Fold",       desc: "Laundry, folding, ironing",   emoji: "🧺" },
  { key: "ASSEMBLY_MOUNTING", label: "Assembly",          desc: "Furniture, TV, shelves",      emoji: "🔩" },
  { key: "GENERAL",           label: "General",           desc: "Odd jobs & fixes",            emoji: "🛠️" },
];

type Handyman = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  rating: number;
  totalJobs: number;
  hourlyRate: number;
  yearsExperience: number;
  responseTime: number;
  isElite: boolean;
  backgroundCheckStatus: string | null;
  accountType?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  distanceKm: number | null;
  score: number;
  latitude: number | null;
  longitude: number | null;
  service: { id: string; title: string; minPrice: number; maxPrice: number; duration: number } | null;
};

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
      <Star className="w-3.5 h-3.5 fill-current" />
      {rating.toFixed(1)}
      <span className="text-slate-500 font-normal">({count})</span>
    </span>
  );
}

export default function BrowsePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const TIME_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const fmtHour = (h: number) => h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPhotoUrl, setTaskPhotoUrl] = useState<string | null>(null);
  const [taskPhotoPreview, setTaskPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    setTaskPhotoPreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "tarea/job-requests");
      const res = await fetch("/api/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setTaskPhotoUrl(data.url);
    } catch { /* ignore */ }
    setUploadingPhoto(false);
  };

  const [handymen, setHandymen] = useState<Handyman[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [sortBy, setSortBy] = useState<"best" | "rating" | "price_low" | "price_high" | "distance">("best");

  const selectedCat = CATEGORIES.find(c => c.key === category);

  const sortedHandymen = [...handymen].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "price_low") return (a.service?.minPrice ?? a.hourlyRate) - (b.service?.minPrice ?? b.hourlyRate);
    if (sortBy === "price_high") return (b.service?.maxPrice ?? b.hourlyRate) - (a.service?.maxPrice ?? a.hourlyRate);
    if (sortBy === "distance") return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    return b.score - a.score; // "best"
  });

  const search = async () => {
    setHandymen([]);
    setLoading(true);
    setStep(3);
    const qs = new URLSearchParams({ category });
    const dateTime = date && selectedHour !== null
      ? `${date}T${String(selectedHour).padStart(2, "0")}:00`
      : date || "";
    if (dateTime) qs.set("date", dateTime);
    if (city) qs.set("city", city);
    const res = await fetch(`/api/match?${qs}`);
    const data = await res.json();
    setHandymen(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">Book a Handyman</h1>
        <p className="text-slate-400 mt-1">Find trusted professionals near you</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Category" },
          { n: 2, label: "When" },
          { n: 3, label: "Choose" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${step >= n ? "text-tarea-sky" : "text-slate-600"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step >= n ? "border-tarea-sky bg-tarea-sky text-tarea-ink" : "border-slate-600 text-slate-600"}`}>
                {n}
              </div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-px w-8 ${step > n ? "bg-tarea-sky" : "bg-slate-700"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Category */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <p className="text-slate-400 text-sm mb-4">What do you need help with?</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((c, i) => {
                const active = category === c.key;
                return (
                  <motion.button
                    key={c.key}
                    onClick={() => { setCategory(c.key); setStep(2); }}
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all text-center ${
                      active
                        ? "bg-sky-500/15 border-sky-400/40 shadow-lg shadow-sky-500/10"
                        : "bg-white/5 border-white/10 hover:bg-sky-500/8 hover:border-sky-400/30"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                      active ? "bg-sky-500/25" : "bg-white/8"
                    }`}>
                      <CategoryIcon catKey={c.key} active={active} />
                    </div>
                    <span className={`text-xs font-semibold leading-tight transition-colors ${
                      active ? "text-tarea-sky" : "text-slate-400"
                    }`}>
                      {c.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            {category && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all"
                >
                  Continue with {CATEGORIES.find(c => c.key === category)?.label} →
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 2: Date + Location */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            className="space-y-5">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-3 p-4 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl">
              <span className="text-3xl">{selectedCat?.emoji}</span>
              <div>
                <p className="text-white font-bold">{selectedCat?.label}</p>
                <p className="text-slate-400 text-sm">{selectedCat?.desc}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 text-tarea-sky" /> What date?
                </label>
                <input
                  type="date"
                  min={minDateStr.slice(0, 10)}
                  value={date}
                  onChange={e => { setDate(e.target.value); setSelectedHour(null); }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-tarea-sky"
                />
              </div>

              {date && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <Clock className="w-4 h-4 text-tarea-sky" /> What time?
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map(h => (
                      <button
                        key={h}
                        onClick={() => setSelectedHour(h)}
                        className={`py-2 rounded-xl text-sm font-semibold transition-all border ${
                          selectedHour === h
                            ? "bg-tarea-sky text-tarea-ink border-tarea-sky"
                            : "bg-white/5 border-white/10 text-slate-300 hover:border-tarea-sky/40 hover:text-white"
                        }`}
                      >
                        {fmtHour(h)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <MapPin className="w-4 h-4 text-tarea-sky" /> Your city
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Miami"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
                />
              </div>

              {/* Task description + photo */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <span className="text-base">📋</span> Describe your task <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  placeholder="e.g. Fix a leaky pipe under the kitchen sink, broken handle on the main shutoff valve…"
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky resize-none"
                />
                <div className="mt-2 flex items-center gap-3">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                  />
                  {taskPhotoPreview ? (
                    <div className="relative group">
                      <img src={taskPhotoPreview} alt="Task photo" className="w-20 h-20 object-cover rounded-xl border border-white/20" />
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => { setTaskPhotoPreview(null); setTaskPhotoUrl(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-white/20 rounded-xl text-slate-400 hover:border-tarea-sky/50 hover:text-tarea-sky transition-all text-sm"
                    >
                      <Camera className="w-4 h-4" /> Add a photo
                    </button>
                  )}
                  {taskPhotoUrl && !uploadingPhoto && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">✓ Photo uploaded</span>
                  )}
                </div>
              </div>

              <button
                onClick={search}
                disabled={loading || !date || selectedHour === null || uploadingPhoto}
                className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? "Finding matches…" : "Find Available Handymen"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Matched handymen */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-slate-400 text-sm">
                  <span className="text-white font-semibold">{handymen.length}</span> available
                </p>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-tarea-sky"
                >
                  <option value="best">Best Match</option>
                  <option value="rating">Top Rated</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="distance">Nearest First</option>
                </select>
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === "list" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white"}`}
                  >
                    <List className="w-3.5 h-3.5" /> List
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === "map" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white"}`}
                  >
                    <Map className="w-3.5 h-3.5" /> Map
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 flex-shrink-0" />
                      <div className="flex-1 space-y-2.5 pt-1">
                        <div className="h-4 bg-white/10 rounded-lg w-2/3" />
                        <div className="flex gap-2">
                          <div className="h-3 bg-white/10 rounded-lg w-16" />
                          <div className="h-3 bg-white/10 rounded-lg w-20" />
                        </div>
                        <div className="h-3 bg-white/10 rounded-lg w-1/2" />
                      </div>
                      <div className="w-14 space-y-2 pt-1 flex-shrink-0">
                        <div className="h-4 bg-white/10 rounded-lg" />
                        <div className="h-3 bg-white/10 rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : handymen.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                <p className="text-2xl">😕</p>
                <p className="text-white font-semibold">No handymen available</p>
                <p className="text-slate-400 text-sm">Try a different date or city.</p>
                <button onClick={() => setStep(2)} className="btn-secondary mt-2">Change filters</button>
              </div>
            ) : viewMode === "map" ? (
              <HandymenMap
                handymen={handymen}
                onSelect={(id) => {
                  const h = handymen.find(x => x.id === id);
                  if (!h) return;
                  const qs = new URLSearchParams({ category, ...(date && { date }), ...(city && { city }), ...(taskDesc && { notes: taskDesc }), ...(taskPhotoUrl && { photo: taskPhotoUrl }) });
                  router.push(`/customer/handymen/${h.userId}?${qs}`);
                }}
              />
            ) : (
              <div className="space-y-3">
                {sortedHandymen.map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
                    <button
                      onClick={() => {
                        const qs = new URLSearchParams({ category, ...(date && { date }), ...(city && { city }), ...(taskDesc && { notes: taskDesc }), ...(taskPhotoUrl && { photo: taskPhotoUrl }) });
                        router.push(`/customer/handymen/${h.userId}?${qs}`);
                      }}
                      className="w-full text-left p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-tarea-sky/40 hover:bg-white/[0.08] transition-all group relative overflow-hidden"
                    >
                      {/* subtle hover gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-tarea-sky/0 to-tarea-sky/0 group-hover:from-tarea-sky/[0.03] group-hover:to-transparent transition-all duration-300 pointer-events-none" />

                      <div className="flex gap-4 relative">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 rounded-2xl bg-tarea-sky/20 flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-tarea-sky/20 transition-all">
                            {h.avatarUrl
                              ? <img src={h.avatarUrl} alt={h.name} className="w-full h-full object-cover" />
                              : <span className="text-2xl font-bold text-tarea-sky">{h.name[0]}</span>}
                          </div>
                          {h.isElite && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-tarea-ink text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-lg">
                              ELITE
                            </span>
                          )}
                          {h.responseTime <= 15 && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0F172A]" title="Responds quickly" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-white font-bold group-hover:text-tarea-sky transition-colors">
                                  {h.accountType === "COMPANY" && h.companyName ? h.companyName : h.name}
                                </p>
                                {h.accountType === "COMPANY" && (
                                  <span className="flex items-center gap-0.5 bg-tarea-sky/20 border border-tarea-sky/30 text-tarea-sky text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    <Building2 className="w-2.5 h-2.5" /> Company
                                  </span>
                                )}
                                {h.backgroundCheckStatus === "PASSED" && (
                                  <span className="flex items-center gap-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                <StarRating rating={h.rating} count={h.totalJobs} />
                                {h.totalJobs > 0 && (
                                  <span className="text-slate-500 text-xs">{h.totalJobs} jobs</span>
                                )}
                                {h.city && (
                                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                                    <MapPin className="w-3 h-3" />
                                    {h.city}{h.distanceKm !== null && ` · ${h.distanceKm.toFixed(0)} km`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 space-y-1">
                              {h.service ? (
                                <>
                                  <p className="text-tarea-sky font-bold text-sm">
                                    {formatCurrency(h.service.minPrice)}–{formatCurrency(h.service.maxPrice)}
                                  </p>
                                  <p className="text-slate-500 text-xs flex items-center gap-1 justify-end">
                                    <Clock className="w-3 h-3" />{h.service.duration} min
                                  </p>
                                </>
                              ) : (
                                <p className="text-tarea-sky font-bold text-sm">${h.hourlyRate}/hr</p>
                              )}
                              <p className="text-tarea-sky text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                Book →
                              </p>
                            </div>
                          </div>

                          {h.bio && (
                            <p className="text-slate-400 text-sm mt-2 line-clamp-1">{h.bio}</p>
                          )}

                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Zap className="w-3 h-3 text-emerald-400" />
                              ~{h.responseTime} min response
                            </span>
                            {h.yearsExperience > 0 && (
                              <span className="text-xs text-slate-500">{h.yearsExperience}yr exp</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {i === 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                          <span className="text-xs font-bold text-tarea-sky bg-tarea-sky/10 px-2.5 py-1 rounded-full">
                            ⭐ Best match for you
                          </span>
                        </div>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
