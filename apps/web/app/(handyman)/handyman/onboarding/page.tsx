"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Check, ChevronRight, ChevronLeft, Wrench, Camera, Loader2, Clock } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${h}:00 ${ampm}` };
});

type AvailSlot = { dayOfWeek: number; startHour: number; endHour: number };

const SERVICES = [
  { category: "PLUMBING",         emoji: "🔧", label: "Plumbing",         desc: "Pipes, leaks, faucets, drain cleaning" },
  { category: "ELECTRICAL",       emoji: "⚡", label: "Electrical",       desc: "Wiring, outlets, panels, lighting" },
  { category: "CARPENTRY",        emoji: "🔨", label: "Carpentry",        desc: "Furniture, framing, doors, shelving" },
  { category: "PAINTING",         emoji: "🎨", label: "Painting",         desc: "Interior, exterior, wallpaper" },
  { category: "CLEANING",         emoji: "🧹", label: "Cleaning",         desc: "Deep clean, move-in/out, regular" },
  { category: "HVAC",             emoji: "❄️", label: "HVAC",             desc: "AC, heating, ventilation, filters" },
  { category: "ROOFING",          emoji: "🏠", label: "Roofing",          desc: "Repairs, gutters, inspections" },
  { category: "LANDSCAPING",      emoji: "🌿", label: "Landscaping",      desc: "Lawn care, trimming, planting" },
  { category: "MOVING",           emoji: "📦", label: "Moving",           desc: "Packing, hauling, assembly" },
  { category: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair", desc: "Washer, dryer, fridge, dishwasher" },
  { category: "GENERAL",          emoji: "🛠️", label: "General",          desc: "Odd jobs, handyman tasks, fixes" },
];

type ServiceEntry = {
  category: string; title: string; description: string;
  minPrice: string; maxPrice: string; duration: string;
};

export default function HandymanOnboarding() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 3 — availability
  const [availability, setAvailability] = useState<Record<number, AvailSlot>>(
    Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { dayOfWeek: d, startHour: 8, endHour: 18 }]))
  );
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

  // Profile picture
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Step 1 — profile info
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("50");
  const [yearsExperience, setYearsExperience] = useState("1");

  // Step 2 — services
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceEntry>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (): Promise<boolean> => {
    if (!avatarFile) return false;
    setUploading(true);
    const form = new FormData();
    form.append("file", avatarFile);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    setUploading(false);
    return res.ok;
  };

  const handleNext = async () => {
    if (!avatarFile) { toast.error("Please upload a profile picture"); return; }
    if (!bio.trim()) { toast.error("Please add a short bio"); return; }
    const ok = await uploadAvatar();
    if (!ok) { toast.error("Image upload failed, try again"); return; }
    setStep(2);
  };

  const toggleService = (cat: string, label: string, desc: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
        if (!serviceDetails[cat]) {
          setServiceDetails(d => ({
            ...d,
            [cat]: { category: cat, title: label, description: desc, minPrice: "50", maxPrice: "150", duration: "60" },
          }));
        }
      }
      return next;
    });
  };

  const updateDetail = (cat: string, field: keyof ServiceEntry, value: string) => {
    setServiceDetails(d => ({ ...d, [cat]: { ...d[cat], [field]: value } }));
  };

  const handleSubmit = async () => {
    if (selected.size === 0) { toast.error("Select at least one service"); return; }
    setStep(3);
  };

  const handleFinish = async () => {
    setSaving(true);
    const slots = Array.from(activeDays).map(d => availability[d]).filter(Boolean);

    const [onboardRes, availRes] = await Promise.all([
      fetch("/api/handyman/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio, hourlyRate, yearsExperience,
          services: Array.from(selected).map(cat => serviceDetails[cat]),
        }),
      }),
      fetch("/api/handyman/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      }),
    ]);

    if (onboardRes.ok && availRes.ok) {
      toast.success("Profile set up! Welcome to Tarea.");
      router.push("/handyman/dashboard");
    } else {
      toast.error("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const toggleDay = (d: number) => {
    setActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
    if (!availability[d]) {
      setAvailability(prev => ({ ...prev, [d]: { dayOfWeek: d, startHour: 8, endHour: 18 } }));
    }
  };

  return (
    <div className="min-h-screen bg-tarea-ink flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-hero-gradient rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Set Up Your Profile</h1>
            <p className="text-slate-400 text-sm">Step {step} of 3</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-8">
          <div className="bg-tarea-sky h-1.5 rounded-full transition-all duration-500"
            style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
              <h2 className="text-xl font-bold text-white">About You</h2>

              {/* Profile picture */}
              <div>
                <label className="label">Profile Picture <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-5">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">Upload</span>
                      </div>
                    )}
                  </button>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p className="text-white font-medium">Upload your photo</p>
                    <p>A clear face photo helps customers trust you.</p>
                    <p>JPG, PNG or WebP — max 5MB</p>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-tarea-sky hover:underline text-xs mt-1">
                      {avatarPreview ? "Change photo" : "Choose file"}
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Bio <span className="text-red-400">*</span></label>
                <textarea value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="e.g. 10 years of experience in plumbing and electrical work. Licensed and insured. Available 7 days a week."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky resize-none h-28" />
              </div>

              {/* Rate + Experience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Hourly Rate ($)</label>
                  <input type="number" min="10" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
                    placeholder="50"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Years of Experience</label>
                  <input type="number" min="0" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)}
                    placeholder="1"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky" />
                </div>
              </div>

              <button onClick={handleNext} disabled={uploading}
                className="w-full btn-primary flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <>Next — Choose Services <ChevronRight className="w-4 h-4" /></>}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-xl font-bold text-white mb-1">Your Services</h2>
                <p className="text-slate-400 text-sm">Select every service you offer and set your price range.</p>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {SERVICES.map(({ category, emoji, label, desc }) => {
                  const isOn = selected.has(category);
                  const detail = serviceDetails[category];
                  return (
                    <div key={category}
                      className={`border rounded-2xl overflow-hidden transition-all duration-200 ${isOn ? "border-tarea-sky bg-tarea-sky/5" : "border-white/10 bg-white/5"}`}>
                      <button onClick={() => toggleService(category, label, desc)}
                        className="w-full flex items-center gap-4 p-4 text-left">
                        <span className="text-2xl">{emoji}</span>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isOn ? "text-tarea-sky" : "text-white"}`}>{label}</p>
                          <p className="text-slate-400 text-xs">{desc}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isOn ? "bg-tarea-sky border-tarea-sky" : "border-white/30"}`}>
                          {isOn && <Check className="w-3 h-3 text-tarea-ink" />}
                        </div>
                      </button>

                      {isOn && detail && (
                        <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-tarea-sky/20 pt-4">
                          <div>
                            <label className="text-slate-300 text-xs font-medium block mb-1">Min Price ($)</label>
                            <input type="number" min="0" value={detail.minPrice}
                              onChange={e => updateDetail(category, "minPrice", e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky text-sm" />
                          </div>
                          <div>
                            <label className="text-slate-300 text-xs font-medium block mb-1">Max Price ($)</label>
                            <input type="number" min="0" value={detail.maxPrice}
                              onChange={e => updateDetail(category, "maxPrice", e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky text-sm" />
                          </div>
                          <div>
                            <label className="text-slate-300 text-xs font-medium block mb-1">Duration (min)</label>
                            <input type="number" min="15" step="15" value={detail.duration}
                              onChange={e => updateDetail(category, "duration", e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky text-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleSubmit} disabled={selected.size === 0}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                  Next — Set Availability <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-tarea-sky" />
                  <h2 className="text-xl font-bold text-white">Your Availability</h2>
                </div>
                <p className="text-slate-400 text-sm">Set which days and hours you're open for bookings. Customers only see you when you're available.</p>
              </div>

              <div className="space-y-3">
                {DAYS.map((day, d) => {
                  const active = activeDays.has(d);
                  const slot = availability[d] ?? { startHour: 8, endHour: 18 };
                  return (
                    <div key={d} className={`rounded-2xl border overflow-hidden transition-all ${active ? "border-tarea-sky/30 bg-tarea-sky/5" : "border-white/10 bg-white/5"}`}>
                      <button onClick={() => toggleDay(d)}
                        className="w-full flex items-center gap-4 px-5 py-3 text-left">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? "bg-tarea-sky border-tarea-sky" : "border-white/30"}`}>
                          {active && <Check className="w-3 h-3 text-tarea-ink" />}
                        </div>
                        <span className={`font-semibold text-sm w-8 ${active ? "text-tarea-sky" : "text-slate-400"}`}>{day}</span>
                        {active && (
                          <span className="text-slate-400 text-xs">
                            {HOURS[slot.startHour].label} – {HOURS[slot.endHour].label}
                          </span>
                        )}
                        {!active && <span className="text-slate-600 text-xs">Not available</span>}
                      </button>

                      {active && (
                        <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-400 text-xs font-medium block mb-1.5">Start time</label>
                            <select
                              value={slot.startHour}
                              onChange={e => setAvailability(prev => ({ ...prev, [d]: { ...slot, startHour: +e.target.value } }))}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-tarea-sky"
                            >
                              {HOURS.slice(0, 23).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-400 text-xs font-medium block mb-1.5">End time</label>
                            <select
                              value={slot.endHour}
                              onChange={e => setAvailability(prev => ({ ...prev, [d]: { ...slot, endHour: +e.target.value } }))}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-tarea-sky"
                            >
                              {HOURS.slice(1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleFinish} disabled={saving || activeDays.size === 0}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : "Finish Setup"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
