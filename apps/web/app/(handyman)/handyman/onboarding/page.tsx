"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dancing_Script } from "next/font/google";

const dancingScript = Dancing_Script({ subsets: ["latin"], weight: "700" });
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Check, ChevronRight, ChevronLeft, Wrench, Camera, Loader2, Clock, ShieldCheck, CreditCard, Clock3, FileText, ScrollText } from "lucide-react";
import { ICA, type IcaBlock } from "@/lib/ica-text";

const BG_CHECK_FEE = 29.99;

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
  { category: "APPLIANCE_REPAIR",   emoji: "🔌", label: "Appliance Repair",    desc: "Washer, dryer, fridge, dishwasher" },
  { category: "WASH_AND_FOLD",     emoji: "🧺", label: "Wash & Fold",         desc: "Laundry, folding, ironing, dry cleaning drop-off" },
  { category: "ASSEMBLY_MOUNTING", emoji: "🔩", label: "Assembly & Mounting", desc: "Furniture assembly, TV mounting, shelves" },
  { category: "GENERAL",           emoji: "🛠️", label: "General",             desc: "Odd jobs, handyman tasks, fixes" },
];

type ServiceEntry = {
  category: string; title: string; description: string;
  hourlyRate: string; duration: string;
};

// Renders the agreement from lib/ica-text.ts — the single source the mobile app
// also reads via GET /api/handyman/ica. Classes are unchanged from when this
// text was inline here, so the rendered document is identical.
function IcaBlockView({ block }: { block: IcaBlock }) {
  if (block.kind === "label") {
    return <p className="text-slate-300 font-medium">{block.text}</p>;
  }
  if (block.kind === "bullets") {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {block.items.map((it, i) => (
          <li key={i}>
            {it.lead ? <><strong className="text-slate-300">{it.lead}</strong> {it.text}</> : it.text}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "caps") {
    const cls = block.tone === "warn"
      ? "text-amber-300 text-xs font-semibold uppercase"
      : "uppercase text-xs text-slate-400 leading-relaxed";
    return (
      <p className={cls}>
        {block.lead ? <><strong className="text-slate-300">{block.lead}</strong> </> : null}
        {block.text}
      </p>
    );
  }
  return (
    <p>
      {block.lead ? <><strong className="text-slate-200">{block.lead}</strong> </> : null}
      {block.text}
    </p>
  );
}

function IcaBody() {
  return (
    <>
      <p className="text-white font-bold text-lg text-center">{ICA.title}</p>
      <p className="text-slate-400 text-xs text-center">{ICA.subtitle}</p>

      <div className="border border-white/10 rounded-lg p-3 space-y-1 text-xs">
        <p className="text-white font-semibold">{ICA.parties.heading}</p>
        {ICA.parties.rows.map((r) => (
          <p key={r.lead}><strong className="text-slate-300">{r.lead}</strong> {r.text}</p>
        ))}
        <p className="mt-2 text-slate-400">{ICA.parties.note}</p>
      </div>

      {ICA.preamble.map((b, i) => <IcaBlockView key={`pre-${i}`} block={b} />)}

      {ICA.sections.map((s) => (
        <Fragment key={s.number}>
          <p className="text-white font-semibold">{s.number}. {s.heading}</p>
          {s.blocks.map((b, i) => <IcaBlockView key={`${s.number}-${i}`} block={b} />)}
        </Fragment>
      ))}

      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-white font-semibold text-center">{ICA.execution.heading}</p>
        <p className="text-slate-400 text-xs text-center">{ICA.execution.note}</p>
        <div className="flex flex-col items-center gap-0.5">
          <p className={`${dancingScript.className} text-2xl text-tarea-sky`}>{ICA.execution.signatureName}</p>
          <p className="text-slate-500 text-xs">{ICA.execution.signatureTitle}</p>
          <p className="text-slate-600 text-xs">{ICA.execution.signatureNote}</p>
        </div>
        <p className="text-center text-slate-600 text-xs">{ICA.execution.footer}</p>
      </div>
    </>
  );
}

export default function HandymanOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const icaScrollRef = useRef<HTMLDivElement>(null);
  const bgCheckResult = searchParams.get("bg_check");
  const [step, setStep] = useState(bgCheckResult === "success" ? 4 : 0);
  const [bgLoading, setBgLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 0 — ICA
  const [icaScrolled, setIcaScrolled] = useState(false);
  const [icaChecked, setIcaChecked] = useState(false);
  const [icaSigning, setIcaSigning] = useState(false);
  useEffect(() => {
    fetch("/api/handyman/ica").then(r => r.json()).then(d => {
      if (d.signed) { setStep(bgCheckResult === "success" ? 4 : 1); }
    });
  }, [bgCheckResult]);

  const handleIcaScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setIcaScrolled(true);
  };

  const signIca = async () => {
    if (!icaChecked) { toast.error("Please check the agreement box first"); return; }
    setIcaSigning(true);
    const res = await fetch("/api/handyman/ica", { method: "POST" });
    if (res.ok) { toast.success("Agreement signed!"); setStep(1); }
    else toast.error("Failed to record signature");
    setIcaSigning(false);
  };

  // Step 3 — availability
  const [availability, setAvailability] = useState<Record<number, AvailSlot>>(
    Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { dayOfWeek: d, startHour: 6, endHour: 20 }]))
  );
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));

  // Profile picture
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ID upload
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState(false);

  // License & insurance
  const licenseDocRef = useRef<HTMLInputElement>(null);
  const insuranceDocRef = useRef<HTMLInputElement>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseDocFile, setLicenseDocFile] = useState<File | null>(null);
  const [licenseDocPreview, setLicenseDocPreview] = useState<string | null>(null);
  const [insuranceDocFile, setInsuranceDocFile] = useState<File | null>(null);
  const [insuranceDocPreview, setInsuranceDocPreview] = useState<string | null>(null);

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

  const uploadIdPhoto = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "tarea/id-docs");
    const res = await fetch("/api/upload/image", { method: "POST", body: form });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleNext = async () => {
    if (!avatarFile) { toast.error("Please upload a profile picture"); return; }
    if (!bio.trim()) { toast.error("Please add a short bio"); return; }
    if (!hourlyRate || parseFloat(hourlyRate) < 10) { toast.error("Please set a valid hourly rate"); return; }
    if (!idFrontFile) { toast.error("Please upload the front of your ID"); return; }
    if (!idBackFile) { toast.error("Please upload the back of your ID"); return; }
    setUploadingId(true);
    const uploads = await Promise.all([
      uploadAvatar(),
      uploadIdPhoto(idFrontFile),
      uploadIdPhoto(idBackFile),
      licenseDocFile ? uploadIdPhoto(licenseDocFile) : Promise.resolve(null),
      insuranceDocFile ? uploadIdPhoto(insuranceDocFile) : Promise.resolve(null),
    ]);
    setUploadingId(false);
    const [avatarOk, idFrontUrl, idBackUrl, licenseDocUrl, insuranceDocUrl] = uploads;
    if (!avatarOk || !idFrontUrl || !idBackUrl) { toast.error("Upload failed, try again"); return; }
    await fetch("/api/handyman/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idFrontUrl, idBackUrl,
        ...(licenseNumber.trim() && { licenseNumber: licenseNumber.trim() }),
        ...(licenseDocUrl && { licenseDocUrl }),
        ...(insuranceDocUrl && { insuranceDocUrl }),
      }),
    });
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
            // Pre-filled from the base rate set a step earlier; a pro who
            // charges more for, say, electrical than for assembly overrides it.
            [cat]: { category: cat, title: label, description: desc, hourlyRate, duration: "60" },
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
      toast.success("Profile set up!");
      setStep(4); // move to background check step
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
      setAvailability(prev => ({ ...prev, [d]: { dayOfWeek: d, startHour: 6, endHour: 20 } }));
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
            <h1 className="text-2xl font-extrabold text-white">
              {step === 0 ? "Independent Contractor Agreement" : "Set Up Your Profile"}
            </h1>
            <p className="text-slate-400 text-sm">{step === 0 ? "Required before you can continue" : `Step ${step} of 4 — ${["", "Profile & ID", "Services", "Availability", "Background Check"][step] ?? ""}`}</p>
          </div>
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-8">
            <div className="bg-tarea-sky h-1.5 rounded-full transition-all duration-500"
              style={{ width: step === 1 ? "25%" : step === 2 ? "50%" : step === 3 ? "75%" : "100%" }} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0 — ICA */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">

              <div className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
                <FileText className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-sm">You must read and sign this Independent Contractor Agreement before accessing the platform.</p>
              </div>

              {/* Scrollable ICA text */}
              <div
                ref={icaScrollRef}
                onScroll={handleIcaScroll}
                className="h-96 overflow-y-auto bg-black/20 border border-white/10 rounded-xl p-5 text-slate-300 text-sm leading-relaxed space-y-4"
              >
                <IcaBody />
              </div>

              {!icaScrolled && (
                <p className="text-slate-500 text-xs text-center flex items-center justify-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5" /> Scroll to the bottom to continue
                </p>
              )}

              {icaScrolled && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={icaChecked}
                    onChange={e => setIcaChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-tarea-sky flex-shrink-0"
                  />
                  <span className="text-slate-300 text-sm leading-relaxed">
                    I have read and agree to the Independent Contractor Agreement. I understand that I am an <strong className="text-white">independent contractor</strong>, not an employee of Tarea US LLC, and that I am responsible for my own taxes, licenses, and insurance.
                  </span>
                </label>
              )}

              <button
                onClick={signIca}
                disabled={!icaChecked || icaSigning}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {icaSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {icaSigning ? "Recording signature…" : "Sign & Continue"}
              </button>
            </motion.div>
          )}

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

              {/* ID Upload */}
              <div>
                <label className="label">Government-Issued ID <span className="text-red-400">*</span></label>
                <p className="text-slate-500 text-xs mb-3">Upload both sides of your driver's license, passport, or state ID. Images are stored securely and only reviewed by Tarea admins.</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Front */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">Front (Recto)</p>
                    <button type="button" onClick={() => idFrontRef.current?.click()}
                      className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
                      {idFrontPreview ? (
                        <img src={idFrontPreview} alt="ID Front" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <FileText className="w-6 h-6" />
                          <span className="text-xs">Upload front</span>
                        </div>
                      )}
                    </button>
                    <input ref={idFrontRef} type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setIdFrontFile(f);
                        const r = new FileReader(); r.onload = () => setIdFrontPreview(r.result as string); r.readAsDataURL(f);
                      }} />
                  </div>
                  {/* Back */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">Back (Verso)</p>
                    <button type="button" onClick={() => idBackRef.current?.click()}
                      className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
                      {idBackPreview ? (
                        <img src={idBackPreview} alt="ID Back" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <FileText className="w-6 h-6" />
                          <span className="text-xs">Upload back</span>
                        </div>
                      )}
                    </button>
                    <input ref={idBackRef} type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setIdBackFile(f);
                        const r = new FileReader(); r.onload = () => setIdBackPreview(r.result as string); r.readAsDataURL(f);
                      }} />
                  </div>
                </div>
              </div>

              {/* License & Insurance */}
              <div className="space-y-4">
                <div>
                  <label className="label">License Number <span className="text-slate-500 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    placeholder="e.g. CSLB-1234567"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-tarea-sky"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* License doc */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">License Document <span className="text-slate-600">(optional)</span></p>
                    <button type="button" onClick={() => licenseDocRef.current?.click()}
                      className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
                      {licenseDocPreview ? (
                        <img src={licenseDocPreview} alt="License" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <FileText className="w-6 h-6" />
                          <span className="text-xs">Upload license</span>
                        </div>
                      )}
                    </button>
                    <input ref={licenseDocRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setLicenseDocFile(f);
                        const r = new FileReader(); r.onload = () => setLicenseDocPreview(r.result as string); r.readAsDataURL(f);
                      }} />
                  </div>
                  {/* Insurance doc */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">Insurance Certificate <span className="text-slate-600">(optional)</span></p>
                    <button type="button" onClick={() => insuranceDocRef.current?.click()}
                      className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-tarea-sky flex items-center justify-center bg-white/5 transition-all">
                      {insuranceDocPreview ? (
                        <img src={insuranceDocPreview} alt="Insurance" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <FileText className="w-6 h-6" />
                          <span className="text-xs">Upload certificate</span>
                        </div>
                      )}
                    </button>
                    <input ref={insuranceDocRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setInsuranceDocFile(f);
                        const r = new FileReader(); r.onload = () => setInsuranceDocPreview(r.result as string); r.readAsDataURL(f);
                      }} />
                  </div>
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

              <button onClick={handleNext} disabled={uploading || uploadingId}
                className="w-full btn-primary flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                {(uploading || uploadingId) ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <>Next — Choose Services <ChevronRight className="w-4 h-4" /></>}
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
                        <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-tarea-sky/20 pt-4">
                          <div>
                            <label className="text-slate-300 text-xs font-medium block mb-1">Your rate ($/hr)</label>
                            <input type="number" min="0" value={detail.hourlyRate}
                              onChange={e => updateDetail(category, "hourlyRate", e.target.value)}
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
                  const slot = availability[d] ?? { startHour: 6, endHour: 20 };
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
                    : "Continue"}
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="space-y-5">

              {/* Header card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-5 h-5 text-tarea-sky" />
                  <h2 className="text-xl font-bold text-white">Background Check Required</h2>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  All Tarea handymen must pass a background check before accepting bookings.
                  This protects customers and builds trust. The one-time fee is <strong className="text-white">${BG_CHECK_FEE}</strong>.
                </p>
              </div>

              {/* Pay now */}
              <button
                disabled={bgLoading}
                onClick={async () => {
                  setBgLoading(true);
                  const res = await fetch("/api/handyman/background-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "now" }),
                  });
                  const data = await res.json();
                  if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                  } else {
                    toast.error("Could not start payment. Try again.");
                    setBgLoading(false);
                  }
                }}
                className="w-full flex items-start gap-4 bg-tarea-sky/10 border-2 border-tarea-sky/40 hover:border-tarea-sky rounded-2xl p-5 text-left transition-all disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-tarea-sky/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-tarea-sky" />
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Pay now — ${BG_CHECK_FEE}</p>
                  <p className="text-slate-400 text-sm">Pay by card via Stripe. Your check starts immediately and typically completes in 1–3 business days.</p>
                </div>
                {bgLoading && <Loader2 className="w-5 h-5 animate-spin text-tarea-sky ml-auto flex-shrink-0" />}
              </button>

              {/* Deduct from first pay */}
              <button
                disabled={bgLoading}
                onClick={async () => {
                  setBgLoading(true);
                  const res = await fetch("/api/handyman/background-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "deferred" }),
                  });
                  if (res.ok) {
                    toast.success("Got it! $29.99 will be deducted from your first payout.");
                    router.push("/handyman/dashboard");
                  } else {
                    toast.error("Something went wrong. Try again.");
                    setBgLoading(false);
                  }
                }}
                className="w-full flex items-start gap-4 bg-white/5 border border-white/10 hover:border-white/30 rounded-2xl p-5 text-left transition-all disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock3 className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <p className="font-bold text-white mb-0.5">Deduct from first payout</p>
                  <p className="text-slate-400 text-sm">Start working now. The $29.99 fee will be automatically deducted from your first cashout.</p>
                </div>
              </button>

              <p className="text-slate-600 text-xs text-center">
                You can accept bookings while the check is processing. Tarea uses Checkr for all background screenings.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
