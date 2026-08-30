"use client";

import { useState, useEffect } from "react";
import ConfirmRequestSheet from "@/components/ui/ConfirmRequestSheet";
import { cld } from "@/lib/cld";
import { useParams, useRouter } from "next/navigation";
import { Star, MapPin, Clock, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import Link from "next/link";

type Service = {
  id: string;
  title: string;
  description: string;
  category: string;
  hourlyRate: number | null;
  duration: number;
  handymanId: string | null;
  handyman: {
    id: string;
    rating: number;
    totalJobs: number;
    user: { id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null };
  } | null;
};

type MatchedHandyman = {
  id: string;
  rating: number;
  totalJobs: number;
  distanceKm: number | null;
  distanceMiles: number | null;
  score: number;
  user: { id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null };
  services: { hourlyRate: number | null }[];
};

type PortfolioPhoto = {
  id: string;
  url: string;
  caption: string | null;
};

function HandymanCard({
  handyman,
  selected,
  onSelect,
}: {
  handyman: MatchedHandyman;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border transition-all ${
        selected
          ? "border-tarea-sky bg-tarea-sky/10"
          : "border-white/10 bg-white/5 hover:border-tarea-sky/40 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-tarea-sky flex items-center justify-center text-tarea-ink font-bold text-lg flex-shrink-0">
          {handyman.user.avatarUrl
            ? <img src={cld(handyman.user.avatarUrl)} alt="" className="w-12 h-12 rounded-xl object-cover" />
            : handyman.user.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold truncate">{handyman.user.name}</p>
            {selected && <CheckCircle2 className="w-5 h-5 text-tarea-sky flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {handyman.rating.toFixed(1)}
            </span>
            <span>{handyman.totalJobs} jobs</span>
            {handyman.user.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {handyman.user.city}
                {handyman.distanceMiles !== null && ` · ${handyman.distanceMiles.toFixed(0)} mi`}
              </span>
            )}
          </div>
        </div>
        {handyman.services[0] && (
          <div className="text-right flex-shrink-0">
            <p className="text-tarea-sky font-bold text-sm">
              {handyman.services[0].hourlyRate != null ? `${formatCurrency(handyman.services[0].hourlyRate)}/hr` : "—"}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [handymen, setHandymen] = useState<MatchedHandyman[]>([]);
  const [selectedHandymanId, setSelectedHandymanId] = useState<string | null>(null);
  const [selectedHandymanUserId, setSelectedHandymanUserId] = useState<string | null>(null);
  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([]);
  const [loadingService, setLoadingService] = useState(true);
  const [loadingHandymen, setLoadingHandymen] = useState(false);
  const [booking, setBooking] = useState(false);

  const [form, setForm] = useState({
    scheduledAt: "",
    address: "",
    city: "",
    notes: "",
    totalPrice: "",
  });

  useEffect(() => {
    fetch(`/api/services/${serviceId}`)
      .then(r => r.json())
      .then((s: Service) => {
        setService(s);
        setLoadingService(false);
        if (s.handymanId && s.handyman) {
          // Pre-select the handyman who owns this service
          setSelectedHandymanId(s.handyman.id);
          setSelectedHandymanUserId(s.handyman.user.id);
        } else {
          // Platform service — fetch matched handymen
          setLoadingHandymen(true);
          fetch(`/api/services/${serviceId}/handymen`)
            .then(r => r.json())
            .then((list: MatchedHandyman[]) => {
              setHandymen(list);
              setLoadingHandymen(false);
            });
        }
      });
  }, [serviceId]);

  // Fetch portfolio photos when a handyman is selected
  useEffect(() => {
    if (!selectedHandymanId) { setPortfolioPhotos([]); return; }
    fetch(`/api/portfolio/handyman/${selectedHandymanId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPortfolioPhotos(Array.isArray(data) ? data : []))
      .catch(() => setPortfolioPhotos([]));
  }, [selectedHandymanId]);

  // When service has a direct handyman, resolve their userId
  useEffect(() => {
    if (service?.handyman) {
      // The handyman.user object has the userId inside
      fetch(`/api/services/${serviceId}`)
        .then(r => r.json())
        .then((s: Service) => {
          if (s.handyman) {
            // We need the user id for booking — fetch from handyman profile via matching API
            fetch(`/api/services/${serviceId}/handymen`)
              .then(r => r.json())
              .then((list: MatchedHandyman[]) => {
                const match = list.find(h => h.id === s.handyman?.id);
                if (match) setSelectedHandymanUserId(match.user.id);
              });
          }
        });
    }
  }, [service, serviceId]);

  // The sheet explains what saving a card does before it is asked for —
  // saved now, charged only after the pro accepts and the customer approves.
  const [confirming, setConfirming] = useState(false);

  const requestPro = () => setConfirming(true);

  const submitBooking = async () => {
    setConfirming(false);
    if (!selectedHandymanUserId) { toast.error("Please select a handyman"); return; }
    if (!form.scheduledAt) { toast.error("Please choose a date and time"); return; }
    if (!form.address || !form.city) { toast.error("Please enter your address"); return; }
    if (!form.totalPrice) { toast.error("Please enter the agreed price"); return; }

    setBooking(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        handymanUserId: selectedHandymanUserId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        address: form.address,
        city: form.city,
        notes: form.notes,
        totalPrice: parseFloat(form.totalPrice),
      }),
    });

    if (res.ok) {
      toast.success("Booking sent! The handyman will confirm shortly.");
      router.push("/customer/bookings");
    } else {
      const body = await res.json();
      toast.error(body.error || "Booking failed");
    }
    setBooking(false);
  };

  if (loadingService) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
      </div>
    );
  }

  if (!service) return <p className="text-slate-400">Service not found.</p>;

  const isPlatform = !service.handymanId;
  const selectedHandyman = isPlatform
    ? handymen.find(h => h.id === selectedHandymanId)
    : service.handyman ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/customer/browse" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to browse
      </Link>

      {/* Service header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-tarea-sky/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <CategoryIcon catKey={service.category} active className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <span className="badge-sky text-xs mb-2 inline-block">{SERVICE_CATEGORY_LABELS[service.category]}</span>
            <h1 className="text-2xl font-extrabold text-white">{service.title}</h1>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">{service.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
              <span className="text-tarea-sky font-bold text-lg">
                {service.hourlyRate != null ? `${formatCurrency(service.hourlyRate)}/hr` : "—"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {service.duration} min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Handyman selection */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">
          {isPlatform ? "Available Handymen near you" : "Your Handyman"}
        </h2>

        {isPlatform ? (
          loadingHandymen ? (
            <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-tarea-sky" />
              Finding best matches near you…
            </div>
          ) : handymen.length === 0 ? (
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-slate-400">
              No handymen available for this service right now.
            </div>
          ) : (
            <div className="space-y-2">
              {handymen.map((h, i) => (
                <div key={h.id} className="relative">
                  {i === 0 && (
                    <span className="absolute -top-2 left-4 text-xs font-bold bg-tarea-sky text-tarea-ink px-2 py-0.5 rounded-full z-10">
                      Best match
                    </span>
                  )}
                  <HandymanCard
                    handyman={h}
                    selected={selectedHandymanId === h.id}
                    onSelect={() => {
                      setSelectedHandymanId(h.id);
                      setSelectedHandymanUserId(h.user.id);
                    }}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          service.handyman && (
            <div className="p-4 rounded-2xl border border-tarea-sky/30 bg-tarea-sky/5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-tarea-sky flex items-center justify-center text-tarea-ink font-bold text-lg flex-shrink-0">
                {service.handyman.user.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{service.handyman.user.name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {service.handyman.rating.toFixed(1)}
                  </span>
                  <span>{service.handyman.totalJobs} jobs</span>
                  {service.handyman.user.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {service.handyman.user.city}
                    </span>
                  )}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-tarea-sky ml-auto" />
            </div>
          )
        )}
      </div>

      {/* Portfolio Photos */}
      {portfolioPhotos.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-white">Portfolio</h2>
          <div className="flex gap-3 flex-wrap">
            {portfolioPhotos.map(photo => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt={photo.caption || "Portfolio photo"}
                  className="w-24 h-24 rounded-xl object-cover border border-white/10"
                />
                {photo.caption && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                    <p className="text-white text-[10px] leading-tight truncate w-full">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Booking Details</h2>

        <div>
          <label className="text-slate-400 text-sm font-medium block mb-1.5">Date & Time <span className="text-red-400">*</span></label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-tarea-sky"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 text-sm font-medium block mb-1.5">Street Address <span className="text-red-400">*</span></label>
            <AddressAutocomplete
              value={form.address}
              onChange={(address, city) => setForm(f => ({ ...f, address, ...(city ? { city } : {}) }))}
              placeholder="123 Main St"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm font-medium block mb-1.5">City <span className="text-red-400">*</span></label>
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
            <span className="text-slate-500 font-normal ml-1">
              (their rate: {service.hourlyRate != null ? `${formatCurrency(service.hourlyRate)}/hr` : "not set"})
            </span>
          </label>
          <input
            type="number"
            min={0}
            value={form.totalPrice}
            onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
            placeholder={String(service.hourlyRate ?? "")}
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

        <button
          onClick={submitBooking}
          disabled={booking || (!selectedHandymanUserId && isPlatform)}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-40 text-sm"
        >
          {booking && <Loader2 className="w-4 h-4 animate-spin" />}
          {booking ? "Sending request…" : isPlatform && !selectedHandymanId ? "Select a handyman first" : "Request Booking"}
        </button>
      </div>
      {confirming && (
        <ConfirmRequestSheet
          proName={selectedHandyman?.user?.name ?? "this pro"}
          labour={parseFloat(form.totalPrice) || 0}
          onConfirm={submitBooking}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>

  );
}
