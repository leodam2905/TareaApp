"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dancing_Script } from "next/font/google";

const dancingScript = Dancing_Script({ subsets: ["latin"], weight: "700" });
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Check, ChevronRight, ChevronLeft, Wrench, Camera, Loader2, Clock, ShieldCheck, CreditCard, Clock3, FileText, ScrollText } from "lucide-react";

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
  { category: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair", desc: "Washer, dryer, fridge, dishwasher" },
  { category: "GENERAL",          emoji: "🛠️", label: "General",          desc: "Odd jobs, handyman tasks, fixes" },
];

type ServiceEntry = {
  category: string; title: string; description: string;
  minPrice: string; maxPrice: string; duration: string;
};

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
  const [icaAlreadySigned, setIcaAlreadySigned] = useState(false);

  useEffect(() => {
    fetch("/api/handyman/ica").then(r => r.json()).then(d => {
      if (d.signed) { setIcaAlreadySigned(true); setStep(bgCheckResult === "success" ? 4 : 1); }
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
    Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { dayOfWeek: d, startHour: 8, endHour: 18 }]))
  );
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

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
    if (!idFrontFile) { toast.error("Please upload the front of your ID"); return; }
    if (!idBackFile) { toast.error("Please upload the back of your ID"); return; }
    setUploadingId(true);
    const [avatarOk, idFrontUrl, idBackUrl] = await Promise.all([
      uploadAvatar(),
      uploadIdPhoto(idFrontFile),
      uploadIdPhoto(idBackFile),
    ]);
    setUploadingId(false);
    if (!avatarOk || !idFrontUrl || !idBackUrl) { toast.error("Upload failed, try again"); return; }
    await fetch("/api/handyman/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idFrontUrl, idBackUrl }),
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
            <h1 className="text-2xl font-extrabold text-white">
              {step === 0 ? "Independent Contractor Agreement" : "Set Up Your Profile"}
            </h1>
            <p className="text-slate-400 text-sm">{step === 0 ? "Required before you can continue" : `Step ${step} of 4`}</p>
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
                <p className="text-white font-bold text-lg text-center">INDEPENDENT CONTRACTOR AGREEMENT</p>
                <p className="text-slate-400 text-xs text-center">Platform Service Professional Agreement · Governing Law: State of California · AB5 Compliant</p>

                <div className="border border-white/10 rounded-lg p-3 space-y-1 text-xs">
                  <p className="text-white font-semibold">PARTIES</p>
                  <p><strong className="text-slate-300">Platform Company:</strong> Tarea US LLC, a California Limited Liability Company</p>
                  <p><strong className="text-slate-300">Principal Office:</strong> 400 N Oakland Avenue, Apt 209, Pasadena, California 91101</p>
                  <p><strong className="text-slate-300">Email:</strong> support@taptarea.com</p>
                  <p className="mt-2 text-slate-400">AND the Pro whose name, business information, and email address are associated with the Tarea account accepting this Agreement electronically.</p>
                </div>

                <p>This Independent Contractor Agreement ("Agreement") is entered into as of the date the Pro electronically accepts through the Tarea platform onboarding process ("Effective Date").</p>
                <p className="text-amber-300 text-xs font-semibold uppercase">IMPORTANT: BY SIGNING OR ELECTRONICALLY ACCEPTING THIS AGREEMENT, THE PRO ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS HEREIN.</p>

                <p className="text-white font-semibold">1. Independent Contractor Status — AB5 Compliance</p>
                <p><strong className="text-slate-200">1.1 — Independent Contractor Relationship.</strong> The Pro is and shall at all times remain an independent contractor and not an employee, agent, partner, joint venturer, or franchisee of Tarea. This Agreement does not create an employment relationship of any kind. The Parties expressly intend to maintain an independent contractor relationship consistent with California AB5, California Labor Code §§ 3350–3371, and applicable federal law.</p>
                <p><strong className="text-slate-200">1.2 — ABC Test Compliance (Cal. Lab. Code § 2775).</strong> The Pro represents, warrants, and agrees as follows:</p>
                <p className="text-slate-300 font-medium">(A) Freedom from Control — Test A:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>The Pro is free from Tarea's control and direction in the performance of services, both under this Agreement and in fact.</li>
                  <li>Tarea does not and shall not direct, supervise, or control the manner, method, means, or details of the Pro's services.</li>
                  <li>The Pro may accept or decline any job request without penalty, deactivation, or negative consequence of any kind.</li>
                  <li>Tarea may not require the Pro to maintain specific hours, minimum bookings, or minimum availability.</li>
                </ul>
                <p className="text-slate-300 font-medium">(B) Work Outside Usual Course of Business — Test B:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>The Pro performs physical home services (plumbing, electrical, carpentry, painting, HVAC, landscaping, or other skilled trades).</li>
                  <li>Tarea is a software technology company providing marketplace infrastructure — not a home services company.</li>
                </ul>
                <p className="text-slate-300 font-medium">(C) Independently Established Trade — Test C:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>The Pro operates their own business, holds required professional licenses, maintains their own tools and equipment, and is available to serve multiple clients.</li>
                  <li>The Pro is free to perform the same services for other platforms, businesses, or clients without restriction by Tarea.</li>
                </ul>
                <p><strong className="text-slate-200">1.3 — No Employment Benefits.</strong> As an independent contractor, the Pro is not entitled to and will not receive: wages or salary from Tarea, workers' compensation, unemployment insurance, health or dental benefits, retirement or 401(k) plans, paid time off, sick leave, reimbursement for tools or expenses, or any other employment benefit required by California or federal law for employees.</p>
                <p><strong className="text-slate-200">1.4 — Tax Obligations.</strong> The Pro is solely responsible for all federal, state, and local taxes on earnings, including self-employment taxes. Tarea will issue IRS Form 1099-NEC for annual earnings of $600 or more. The Pro agrees to provide a completed IRS Form W-9 prior to receiving any payout.</p>

                <p className="text-white font-semibold">2. Platform Access and Use</p>
                <p><strong className="text-slate-200">2.1 — Pro Autonomy.</strong> The Pro has complete autonomy to: set their own rates and pricing; define their own hours and availability; set their own service area; accept or decline any job request for any reason; use other platforms or direct channels simultaneously; and work for competitors with no exclusivity obligation to Tarea.</p>
                <p><strong className="text-slate-200">2.2 — Platform Rules.</strong> While retaining full autonomy over their work, the Pro agrees to: maintain required licenses and insurance; treat Customers professionally; accurately represent qualifications; not solicit Customers off-platform during this Agreement and for 12 months after termination; and comply with all applicable laws. Compliance with Platform rules is a condition of platform access only — not a condition of employment.</p>

                <p className="text-white font-semibold">3. Licensing, Insurance, and Compliance</p>
                <p><strong className="text-slate-200">3.1 — Required Licenses.</strong> The Pro warrants they hold all required licenses including: California CSLB license for work valued at $500+ in labor and materials (Cal. Bus. &amp; Prof. Code § 7028); any trade-specific license required by California or applicable municipality; and any local business license required where the Pro operates.</p>
                <p><strong className="text-slate-200">3.2 — Insurance Requirements.</strong> The Pro must maintain: General Liability Insurance (minimum $1,000,000 per occurrence / $2,000,000 aggregate); Commercial Auto Insurance if driving to job sites (minimum $100,000 per occurrence); Workers' Compensation if the Pro has their own employees (as required by California law). The Pro shall name Tarea US LLC as an additional insured on their general liability policy upon request. Failure to maintain required insurance is grounds for immediate suspension.</p>
                <p><strong className="text-slate-200">3.3 — Worker Classification.</strong> If the Pro employs or subcontracts any workers, the Pro — not Tarea — is solely responsible for properly classifying, compensating, and providing benefits to those workers in accordance with AB5 and applicable law.</p>

                <p className="text-white font-semibold">4. Compensation and Payments</p>
                <p><strong className="text-slate-200">4.1 — Fee Structure.</strong> The Pro earns 90% of their stated service rate for each completed booking. Tarea retains a 10% platform fee for marketplace technology, payment processing, and customer acquisition services. The Pro independently sets their own rates.</p>
                <p><strong className="text-slate-200">4.2 — Payout Processing.</strong> Payouts are processed via Stripe Connect. The Pro must maintain a Stripe Connect account and comply with Stripe's Terms of Service. Standard payout timing is within 30 minutes of job completion, subject to Stripe's processing schedule.</p>
                <p><strong className="text-slate-200">4.3 — Fee Changes.</strong> Tarea may modify the platform fee upon 30 days' written notice. Continued use after notice constitutes acceptance. If the Pro does not accept, they may terminate this Agreement.</p>
                <p><strong className="text-slate-200">4.4 — Cancellation Compensation.</strong> If a Customer cancels a confirmed booking within 24 hours of the scheduled time, the Pro receives 50% of the agreed service rate as compensation.</p>

                <p className="text-white font-semibold">5. Tools, Equipment, and Expenses</p>
                <p>The Pro is solely responsible for providing all tools, equipment, vehicles, materials, and supplies necessary to perform services. Tarea shall not provide, reimburse, or subsidize any tools, equipment, or business expenses. The Pro's use of their own tools and equipment is a hallmark of independent contractor status under California law.</p>

                <p className="text-white font-semibold">6. Intellectual Property</p>
                <p>All Tarea intellectual property remains Tarea's exclusive property. The Pro retains ownership of content uploaded to the Platform but grants Tarea a non-exclusive, royalty-free, worldwide license to display and use such content on the Platform and in promotional materials for as long as the Pro's account is active. Any physical work product created for Customers belongs to the Customer — not Tarea.</p>

                <p className="text-white font-semibold">7. Confidentiality</p>
                <p>The Pro agrees to keep confidential all non-public information regarding Tarea's business, technology, Customer data, pricing algorithms, and trade secrets. This obligation survives termination for three (3) years. Confidential Information excludes information that is publicly known through no breach of this Agreement.</p>

                <p className="text-white font-semibold">8. Indemnification and Liability</p>
                <p><strong className="text-slate-200">8.1 — Pro Indemnification.</strong> The Pro shall indemnify, defend, and hold harmless Tarea from any claims arising out of: the Pro's performance of services; breach of this Agreement; any claim the Pro is an employee of Tarea; any injury or property damage caused by the Pro; failure to maintain required licenses or insurance; or misclassification of the Pro's own workers.</p>
                <p className="uppercase text-xs text-slate-400 leading-relaxed"><strong className="text-slate-300">8.2 — Limitation of Tarea's Liability.</strong> TO THE MAXIMUM EXTENT PERMITTED BY CALIFORNIA LAW, TAREA'S TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL PLATFORM FEES PAID TO THE PRO IN THE THREE (3) MONTHS PRECEDING THE CLAIM. TAREA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</p>
                <p><strong className="text-slate-200">8.3 — No Guarantee of Work.</strong> Tarea makes no guarantee of the volume, frequency, or value of job requests the Pro will receive through the Platform.</p>

                <p className="text-white font-semibold">9. Term and Termination</p>
                <p><strong className="text-slate-200">9.1 — Term.</strong> This Agreement begins on the Effective Date and continues until terminated by either Party.</p>
                <p><strong className="text-slate-200">9.2 — Termination by Pro.</strong> The Pro may terminate at any time by written notice to support@taptarea.com and deactivating their account. Termination does not relieve the Pro of obligations for services already booked.</p>
                <p><strong className="text-slate-200">9.3 — Termination by Tarea.</strong> Tarea may suspend or terminate the Pro's access at any time for: violation of this Agreement or Terms of Service; failure to maintain licenses or insurance; repeated low ratings or Customer complaints; fraudulent, abusive, or illegal conduct; or any action creating legal, reputational, or safety risk. Deactivation does not constitute termination of employment — no such relationship exists.</p>
                <p><strong className="text-slate-200">9.4 — Effect of Termination.</strong> Upon termination: the Pro's platform access immediately ceases; outstanding payouts for completed services will be processed within the standard window; and confidentiality, indemnification, non-solicitation, and dispute resolution obligations survive.</p>

                <p className="text-white font-semibold">10. Non-Solicitation</p>
                <p>During this Agreement and for twelve (12) months following termination, the Pro agrees not to directly solicit Customers introduced through Tarea to transact outside the Platform for the same or similar services. This is not a non-compete — the Pro may freely offer services through other channels to independently obtained customers.</p>

                <p className="text-white font-semibold">11. Dispute Resolution, Arbitration, and PAGA Waiver</p>
                <p><strong className="text-slate-200">11.1 — Informal Resolution.</strong> The Parties agree to attempt in good faith to resolve any dispute for thirty (30) days before initiating formal proceedings.</p>
                <p><strong className="text-slate-200">11.2 — Binding Arbitration.</strong> Any unresolved dispute shall be resolved by final and binding individual arbitration administered by JAMS or AAA in Los Angeles County, California, applying California law.</p>
                <p className="uppercase text-xs text-slate-400 leading-relaxed"><strong className="text-slate-300">11.3 — Class and Collective Action Waiver.</strong> THE PRO WAIVES THE RIGHT TO PARTICIPATE IN ANY CLASS ACTION, COLLECTIVE ACTION, CLASS ARBITRATION, OR REPRESENTATIVE PROCEEDING. ALL DISPUTES MUST BE BROUGHT INDIVIDUALLY.</p>
                <p><strong className="text-slate-200">11.4 — PAGA Waiver.</strong> To the fullest extent permitted by California law, the Pro waives any right to bring a PAGA representative action (Labor Code § 2698 et seq.) on behalf of others. Any individual PAGA claim not subject to waiver shall be litigated in a California court, with all other claims remaining in arbitration.</p>

                <p className="text-white font-semibold">12. Governing Law and Jurisdiction</p>
                <p>This Agreement is governed by California law. Any claims not subject to arbitration shall be brought in the state or federal courts of Los Angeles County, California.</p>

                <p className="text-white font-semibold">13. General Provisions</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-slate-300">Entire Agreement:</strong> This Agreement together with Tarea's Terms of Service and Privacy Policy is the entire agreement between the Parties.</li>
                  <li><strong className="text-slate-300">Amendment:</strong> Tarea may amend upon 30 days' written notice. Continued use constitutes acceptance.</li>
                  <li><strong className="text-slate-300">Severability:</strong> If any provision is held invalid, remaining provisions continue in full force.</li>
                  <li><strong className="text-slate-300">Electronic Signatures:</strong> Electronic acceptance has the same legal effect as a handwritten signature under the California Uniform Electronic Transactions Act (Cal. Civ. Code § 1633.1 et seq.) and the federal E-SIGN Act.</li>
                  <li><strong className="text-slate-300">Notices:</strong> Notices to Tarea shall be sent to support@taptarea.com.</li>
                </ul>

                <div className="border-t border-white/10 pt-4 space-y-2">
                  <p className="text-white font-semibold text-center">EXECUTION</p>
                  <p className="text-slate-400 text-xs text-center">By clicking "Sign &amp; Continue" below, you electronically sign this Agreement on behalf of yourself or your business entity. Your electronic signature, IP address, and timestamp will be recorded as legally binding evidence of your acceptance.</p>
                  <div className="flex flex-col items-center gap-0.5">
                    <p className={`${dancingScript.className} text-2xl text-tarea-sky`}>Debohi Jean Jacques Dah</p>
                    <p className="text-slate-500 text-xs">Debohi Jean Jacques Dah — Chief Executive Officer, Tarea US LLC</p>
                    <p className="text-slate-600 text-xs">Signed electronically on behalf of Tarea US LLC</p>
                  </div>
                  <p className="text-center text-slate-600 text-xs">© 2026 Tarea US LLC · 400 N Oakland Ave, Apt 209, Pasadena, CA 91101 · legal@tarea.app</p>
                </div>
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
