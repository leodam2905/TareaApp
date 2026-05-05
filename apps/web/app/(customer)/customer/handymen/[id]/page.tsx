"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Star, MapPin, Clock, Zap, ArrowLeft, Loader2, CheckCircle2, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_ICONS } from "@/lib/utils";
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
    services: { id: string; title: string; category: string; minPrice: number; maxPrice: number; duration: number }[];
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

  const [handyman, setHandyman] = useState<HandymanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [portfolio, setPortfolio] = useState<{ id: string; url: string; caption: string | null }[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [form, setForm] = useState({
    scheduledAt: prefillDate,
    address: "",
    city: prefillCity,
    notes: "",
    totalPrice: "",
    promoCode: "",
  });

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
      });
  }, [id]);

  const profile = handyman?.handymanProfile;
  const service = profile?.services.find(s => s.category === category) ?? profile?.services[0] ?? null;
  const isElite = profile && profile.rating >= 4.5 && profile.totalJobs >= 10;

  const submitBooking = async () => {
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
        notes: form.notes,
        totalPrice: parseFloat(form.totalPrice),
        ...(form.promoCode.trim() && { promoCode: form.promoCode.trim().toUpperCase() }),
      }),
    });

    if (res.ok) {
      toast.success("Booking request sent! Handyman will respond within 1 hour.");
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
                ? <img src={handyman.avatarUrl} alt={handyman.name} className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-tarea-sky">{handyman.name[0]}</span>}
            </div>
            {isElite && (
              <span className="absolute -top-2 -right-2 bg-amber-400 text-tarea-ink text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                ELITE
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-white">{handyman.name}</h1>
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
              <span className="text-xl">{SERVICE_CATEGORY_ICONS[s.category] || "🛠️"}</span>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{s.title}</p>
                <p className="text-slate-500 text-xs">{SERVICE_CATEGORY_LABELS[s.category]}</p>
              </div>
              <div className="text-right">
                <p className="text-tarea-sky font-bold text-sm">{formatCurrency(s.minPrice)}–{formatCurrency(s.maxPrice)}</p>
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
                <img src={p.url} alt={p.caption ?? "Portfolio"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
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
          <img src={lightbox} alt="Portfolio" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}

      {/* Booking form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-tarea-sky" /> Book {handyman.name.split(" ")[0]}
        </h2>

        {service && (
          <div className="flex items-center gap-3 p-3 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl text-sm">
            <span>{SERVICE_CATEGORY_ICONS[service.category] || "🛠️"}</span>
            <span className="text-white font-medium">{service.title}</span>
            <span className="ml-auto text-tarea-sky font-bold">
              {formatCurrency(service.minPrice)}–{formatCurrency(service.maxPrice)}
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
                (range: {formatCurrency(service.minPrice)}–{formatCurrency(service.maxPrice)})
              </span>
            )}
          </label>
          <input
            type="number"
            min={service?.minPrice}
            max={service?.maxPrice}
            value={form.totalPrice}
            onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
            placeholder={String(service?.minPrice ?? "")}
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
          <label className="text-slate-400 text-sm font-medium block mb-1.5">Promo Code (optional)</label>
          <input
            value={form.promoCode}
            onChange={e => setForm(f => ({ ...f, promoCode: e.target.value.toUpperCase() }))}
            placeholder="SAVE10"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky font-mono tracking-widest"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 rounded-xl px-3 py-2.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          {handyman.name.split(" ")[0]} typically responds within {profile.responseTime} minutes. You'll be notified once confirmed.
        </div>

        <button
          onClick={submitBooking}
          disabled={booking}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
        >
          {booking && <Loader2 className="w-4 h-4 animate-spin" />}
          {booking ? "Sending request…" : "Request Booking"}
        </button>
      </div>
    </div>
  );
}

