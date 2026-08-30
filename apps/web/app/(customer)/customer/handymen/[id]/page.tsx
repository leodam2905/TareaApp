"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import ConfirmRequestSheet from "@/components/ui/ConfirmRequestSheet";
import { cld } from "@/lib/cld";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Star, MapPin, Clock, Zap, ArrowLeft, Loader2, CheckCircle2, Calendar, Tag, X, ShieldCheck, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import Link from "next/link";

type HandymanDetail = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  handymanProfile: {
    id: string;
    bio: string | null;
    rating: number;
    totalJobs: number;
    hourlyRate: number;
    yearsExperience: number;
    responseTime: number;
    backgroundCheckStatus: string | null;
    services: { id: string; title: string; category: string; hourlyRate: number | null; duration: number }[];
  } | null;
};

export default function HandymanProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const category = searchParams.get("category") || "";
  const prefillDate = searchParams.get("date") || "";
  const prefillCity = searchParams.get("city") || "";
  const prefillNotes = searchParams.get("notes") || "";
  const prefillPhoto = searchParams.get("photo") || "";

  const [taskPhotoUrl, setTaskPhotoUrl] = useState(prefillPhoto);
  const [taskPhotoPreview, setTaskPhotoPreview] = useState(prefillPhoto);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    setTaskPhotoPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "tarea/job-requests");
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setTaskPhotoUrl(url);
      } else {
        toast.error("Photo upload failed");
        setTaskPhotoPreview(taskPhotoUrl);
      }
    } catch {
      toast.error("Photo upload failed");
      setTaskPhotoPreview(taskPhotoUrl);
    }
    setUploadingPhoto(false);
  };

  const [handyman, setHandyman] = useState<HandymanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [portfolio, setPortfolio] = useState<{ id: string; url: string; caption: string | null }[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; createdAt: string; author: { name: string; avatarUrl: string | null } }[]>([]);

  const [form, setForm] = useState({
    scheduledAt: prefillDate,
    address: "",
    city: prefillCity,
    notes: prefillNotes,
    totalPrice: "",
    promoCode: "",
  });

  const [promoInput, setPromoInput] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    code: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoValidating(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim() }),
      });
      const body = await res.json();
      if (body.valid) {
        setPromoResult(body);
        setForm(f => ({ ...f, promoCode: body.code }));
      } else {
        setPromoError(body.error || "Invalid promo code");
      }
    } catch {
      setPromoError("Could not validate code");
    } finally {
      setPromoValidating(false);
    }
  };

  const clearPromo = () => {
    setPromoResult(null);
    setPromoError("");
    setPromoInput("");
    setForm(f => ({ ...f, promoCode: "" }));
  };

  const basePrice = parseFloat(form.totalPrice) || 0;
  const discount = promoResult
    ? promoResult.discountType === "PERCENTAGE"
      ? (basePrice * promoResult.discountValue) / 100
      : Math.min(promoResult.discountValue, basePrice)
    : 0;
  const finalPrice = Math.max(0, basePrice - discount);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(d => {
        setHandyman(d);
        setLoading(false);
        if (d?.handymanProfile?.id) {
          fetch(`/api/portfolio/handyman/${d.handymanProfile.id}`)
            .then(r => r.json())
            .then(photos => setPortfolio(Array.isArray(photos) ? photos : []));
        }
        fetch(`/api/reviews/handyman/${id}`)
          .then(r => r.json())
          .then(data => setReviews(Array.isArray(data) ? data : []));
      });
  }, [id]);

  const profile = handyman?.handymanProfile;
  const service = profile?.services.find(s => s.category === category) ?? profile?.services[0] ?? null;
  const isElite = profile && profile.rating >= 4.5 && profile.totalJobs >= 10;

  // The sheet explains what saving a card does before it is asked for —
  // saved now, charged only after the pro accepts and the customer approves.
  const [confirming, setConfirming] = useState(false);

  const requestPro = () => setConfirming(true);

  const submitBooking = async () => {
    setConfirming(false);
    if (!form.scheduledAt) { toast.error("Please choose a date and time"); return; }
    if (!form.address || !form.city) { toast.error("Please enter your address"); return; }
    if (!form.totalPrice) { toast.error("Please enter the agreed price"); return; }
    if (!service) { toast.error("No service found for this handyman"); return; }

    setBooking(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
        handymanUserId: id,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        address: form.address,
        city: form.city,
        notes: [form.notes.trim(), taskPhotoUrl ? `Photo: ${taskPhotoUrl}` : ""].filter(Boolean).join("\n\n"),
        totalPrice: parseFloat(form.totalPrice),
        ...(form.promoCode.trim() && { promoCode: form.promoCode.trim().toUpperCase() }),
      }),
    });

    if (res.ok) {
      toast.success("Booking request sent! Handyman will respond within 2 hours.");
      router.push("/customer/bookings");
    } else {
      const body = await res.json();
      toast.error(body.error || "Booking failed");
    }
    setBooking(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
      </div>
    );
  }

  if (!handyman || !profile) return <p className="text-slate-400">Handyman not found.</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/customer/browse`}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to results
      </Link>

      {/* Profile card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-tarea-sky/20 flex items-center justify-center overflow-hidden">
              {handyman.avatarUrl
                ? <img src={cld(handyman.avatarUrl)} alt={handyman.name} className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-tarea-sky">{handyman.name[0]}</span>}
            </div>
            {isElite && (
              <span className="absolute -top-2 -right-2 bg-amber-400 text-tarea-ink text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                ELITE
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold text-white">{handyman.name}</h1>
              {profile.backgroundCheckStatus === "PASSED" && (
                <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Star className="w-4 h-4 fill-current" />
                {profile.rating.toFixed(1)}
                <span className="text-slate-500 font-normal text-sm">({profile.totalJobs} reviews)</span>
              </span>
              {handyman.city && (
                <span className="flex items-center gap-1 text-slate-400 text-sm">
                  <MapPin className="w-3.5 h-3.5" /> {handyman.city}{handyman.state && `, ${handyman.state}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span className="text-white font-bold">${profile.hourlyRate}/hr</span>
              {profile.yearsExperience > 0 && (
                <span className="text-slate-400">{profile.yearsExperience} yrs experience</span>
              )}
              <span className="flex items-center gap-1 text-slate-400">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Responds in ~{profile.responseTime} min
              </span>
            </div>
          </div>
        </div>

        {profile.bio && (
          <div className="mt-5 pt-5 border-t border-white/10">
            <p className="text-slate-300 text-sm leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/10">
          {[
            { label: "Jobs Done", value: profile.totalJobs },
            { label: "Rating", value: `${profile.rating.toFixed(1)} ★` },
            { label: "Response", value: `~${profile.responseTime}m` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-white font-bold">{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Services offered */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Services Offered</h2>
        <div className="space-y-2">
          {profile.services.map(s => (
            <div key={s.id}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${s.category === category ? "border-tarea-sky/40 bg-tarea-sky/10" : "border-white/10 bg-white/5"}`}>
              <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <CategoryIcon catKey={s.category} className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{s.title}</p>
                <p className="text-slate-500 text-xs">{SERVICE_CATEGORY_LABELS[s.category]}</p>
              </div>
              <div className="text-right">
                <p className="text-tarea-sky font-bold text-sm">{s.hourlyRate != null ? `${formatCurrency(s.hourlyRate)}/hr` : "—"}</p>
                <p className="text-slate-500 text-xs flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />{s.duration} min
                </p>
              </div>
              {s.category === category && <CheckCircle2 className="w-4 h-4 text-tarea-sky flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio gallery */}
      {portfolio.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">Portfolio</h2>
          <div className="grid grid-cols-3 gap-2">
            {portfolio.map(p => (
              <button key={p.id} onClick={() => setLightbox(p.url)}
                className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-tarea-sky/40 transition-colors">
                <img src={cld(p.url)} alt={p.caption ?? "Portfolio"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={cld(lightbox)} alt="Portfolio" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            Reviews ({reviews.length})
          </h2>
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-tarea-sky/20 flex items-center justify-center text-tarea-sky text-sm font-bold overflow-hidden flex-shrink-0">
                      {r.author.avatarUrl
                        ? <img src={cld(r.author.avatarUrl)} alt="" className="w-full h-full object-cover" />
                        : r.author.name[0]}
                    </div>
                    <p className="text-white text-sm font-semibold">{r.author.name}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-slate-300 text-sm leading-relaxed">{r.comment}</p>}
                <p className="text-slate-600 text-xs">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-tarea-sky" /> Book {handyman.name.split(" ")[0]}
        </h2>

        {service && (
          <div className="flex items-center gap-3 p-3 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl text-sm">
            <CategoryIcon catKey={service.category} active className="w-5 h-5 flex-shrink-0" />
            <span className="text-white font-medium">{service.title}</span>
            <span className="ml-auto text-tarea-sky font-bold">
              {service.hourlyRate != null ? `${formatCurrency(service.hourlyRate)}/hr` : "—"}
            </span>
          </div>
        )}

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-1.5">
            Date & Time <span className="text-red-400">*</span>
          </label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-tarea-sky"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 text-sm font-medium block mb-1.5">
              Street Address <span className="text-red-400">*</span>
            </label>
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm font-medium block mb-1.5">
              City <span className="text-red-400">*</span>
            </label>
            <input
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="Miami"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-1.5">
            Agreed Price ($) <span className="text-red-400">*</span>
            {service && (
              <span className="text-slate-500 font-normal ml-1">
                (their rate: {service.hourlyRate != null ? `${formatCurrency(service.hourlyRate)}/hr` : "not set"})
              </span>
            )}
          </label>
          <input
            type="number"
            min={0}
            value={form.totalPrice}
            onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
            placeholder={String(service?.hourlyRate ?? "")}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-1.5">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Describe what needs to be done…"
            rows={3}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky resize-none"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-2">
            Task photo <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
          />
          {taskPhotoPreview ? (
            <div className="flex items-center gap-3">
              <div className="relative group flex-shrink-0">
                <img src={taskPhotoPreview} alt="Task" className="w-20 h-20 rounded-xl object-cover border border-white/20" />
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setTaskPhotoPreview(""); setTaskPhotoUrl(""); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <div>
                {uploadingPhoto
                  ? <p className="text-slate-400 text-xs">Uploading…</p>
                  : <p className="text-emerald-400 text-xs font-medium">✓ Photo attached</p>
                }
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-tarea-sky text-xs mt-1 hover:underline"
                >
                  Change photo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-white/20 rounded-xl text-slate-400 hover:border-tarea-sky/50 hover:text-tarea-sky transition-all text-sm"
            >
              <Camera className="w-4 h-4" /> Add a photo
            </button>
          )}
        </div>

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-1.5">
            <Tag className="w-3.5 h-3.5 inline mr-1 mb-0.5" />
            Promo Code (optional)
          </label>
          {promoResult ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-300 font-mono font-bold text-sm">{promoResult.code}</p>
                <p className="text-emerald-400/70 text-xs">
                  {promoResult.discountType === "PERCENTAGE"
                    ? `${promoResult.discountValue}% off`
                    : `$${promoResult.discountValue.toFixed(2)} off`}
                  {basePrice > 0 && ` — saving ${discount > 0 ? `$${discount.toFixed(2)}` : "$0.00"}`}
                </p>
              </div>
              <button onClick={clearPromo} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                onKeyDown={e => e.key === "Enter" && applyPromo()}
                placeholder="SAVE10"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky font-mono tracking-widest"
              />
              <button
                onClick={applyPromo}
                disabled={promoValidating || !promoInput.trim()}
                className="px-4 py-2.5 rounded-xl border border-tarea-sky/40 text-tarea-sky text-sm font-semibold hover:bg-tarea-sky/10 transition-colors disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
              >
                {promoValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply
              </button>
            </div>
          )}
          {promoError && <p className="text-red-400 text-xs mt-1.5">{promoError}</p>}
        </div>

        {/* Price summary */}
        {basePrice > 0 && (
          <div className="bg-white/5 rounded-xl px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Service price</span>
              <span>${basePrice.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Promo discount</span>
                <span>−${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold pt-1.5 border-t border-white/10">
              <span>Total</span>
              <span>${finalPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 rounded-xl px-3 py-2.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          {handyman.name.split(" ")[0]} typically responds within {profile.responseTime} minutes. You'll be notified once confirmed.
        </div>

        <button
          onClick={submitBooking}
          disabled={booking || uploadingPhoto}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
        >
          {(booking || uploadingPhoto) && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploadingPhoto ? "Uploading photo…" : booking ? "Sending request…" : "Request Booking"}
        </button>
      </div>
      {confirming && (
        <ConfirmRequestSheet
          proName={handyman?.name ?? "this pro"}
          labour={parseFloat(form.totalPrice) || 0}
          onConfirm={submitBooking}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>

  );
}

