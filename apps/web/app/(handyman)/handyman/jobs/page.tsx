"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, MapPin, Calendar, DollarSign, Loader2, Navigation, MessageCircle, List, CalendarDays } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { useT } from "@/contexts/LanguageContext";
import BookingCalendar from "@/components/ui/BookingCalendar";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  address: string;
  city: string;
  totalPrice: number;
  notes: string | null;
  responseDeadline: string | null;
  isOnMyWay: boolean;
  createdAt: string;
  service: { title: string; category: string };
  customer: { name: string; phone: string | null; avatarUrl: string | null };
};

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setUrgent(m < 15);
      setRemaining(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${urgent ? "bg-red-500/20 text-red-400" : "bg-amber-400/20 text-amber-400"}`}>
      <Clock className="w-3 h-3" /> Respond in {remaining}
    </span>
  );
}

const STATUS_GROUPS: Record<string, string[]> = {
  pending:    ["PENDING"],
  active:     ["ACCEPTED", "IN_PROGRESS"],
  done:       ["COMPLETED", "CANCELLED", "DISPUTED"],
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: "Pending",     cls: "badge-yellow" },
  ACCEPTED:    { label: "Accepted",    cls: "badge-sky"    },
  IN_PROGRESS: { label: "In Progress", cls: "badge-sky"    },
  COMPLETED:   { label: "Completed",   cls: "badge-green"  },
  CANCELLED:   { label: "Cancelled",   cls: "badge-red"    },
  DISPUTED:    { label: "Disputed",    cls: "badge-red"    },
};

export default function HandymanJobsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "active" | "done">("pending");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const { t } = useT();

  const load = useCallback(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBookings(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: "ACCEPTED" | "CANCELLED", reason?: string) => {
    setActing(id);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(reason && { cancelReason: reason }) }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      toast.success(status === "ACCEPTED" ? t("status_accepted") + "!" : t("btn_decline"));
    } else {
      toast.error("Action failed");
    }
    setActing(null);
  };

  const shareLocation = (id: string, currentIsOnMyWay: boolean) => {
    if (currentIsOnMyWay) {
      fetch(`/api/bookings/${id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnMyWay: false }),
      }).then(() => {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, isOnMyWay: false } : b));
        toast("Location sharing stopped.");
      });
      return;
    }
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      fetch(`/api/bookings/${id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, isOnMyWay: true }),
      }).then(() => {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, isOnMyWay: true } : b));
        toast.success(t("toast_on_way"));
      });
    }, () => toast.error("Location access denied"));
  };

  const visible = bookings.filter(b => STATUS_GROUPS[tab].includes(b.status));
  const pendingCount = bookings.filter(b => b.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">{t("page_my_jobs")}</h1>
          <p className="text-slate-400 mt-1">{t("page_my_jobs_sub")}</p>
        </div>
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
          <button onClick={() => setViewMode("list")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "list" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white")}>
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setViewMode("calendar")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "calendar" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white")}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
      </div>

      {viewMode === "calendar" && !loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <BookingCalendar bookings={bookings.map(b => ({ ...b, customer: { name: b.customer.name } }))} role="HANDYMAN" baseHref="/handyman/jobs" />
        </div>
      )}

      {viewMode === "list" && (
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
        {(["pending", "active", "done"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize flex items-center gap-2 ${tab === t ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white"}`}
          >
            {t}
            {t === "pending" && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center text-slate-400">
          {t("empty_my_jobs", { tab })}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(b => {
            const cfg = STATUS_LABEL[b.status];
            const isPending = b.status === "PENDING";
            return (
              <div key={b.id} className={`rounded-2xl border p-5 space-y-4 transition-all ${isPending ? "border-amber-400/30 bg-amber-400/5" : "border-white/10 bg-white/5"}`}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CategoryIcon catKey={b.service.category} className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-white font-bold">{b.service.title}</p>
                      <p className="text-slate-400 text-sm">{b.customer.name}</p>
                      {b.customer.phone && <p className="text-slate-500 text-xs">📞 {b.customer.phone}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={cfg.cls}>{cfg.label}</span>
                    {isPending && b.responseDeadline && <Countdown deadline={b.responseDeadline} />}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4 text-tarea-sky" />
                    <span>{formatDate(new Date(b.scheduledAt))}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-semibold">{formatCurrency(b.totalPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 col-span-2">
                    <MapPin className="w-4 h-4 text-tarea-sky" />
                    <span>{b.address}, {b.city}</span>
                  </div>
                  {b.notes && (
                    <p className="text-slate-500 text-xs col-span-2 italic">"{b.notes}"</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-white/10 flex-wrap">
                  {/* Chat button — always available for non-cancelled/completed */}
                  {!["CANCELLED", "DISPUTED"].includes(b.status) && (
                    <Link href={`/chat/${b.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-medium">
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </Link>
                  )}

                  {isPending && (<>
                    <button
                      onClick={() => act(b.id, "CANCELLED", "Handyman declined")}
                      disabled={acting === b.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                    <button
                      onClick={() => act(b.id, "ACCEPTED")}
                      disabled={acting === b.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all text-sm font-semibold disabled:opacity-50"
                    >
                      {acting === b.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Accept Job
                    </button>
                  </>)}

                  {/* On My Way button — for accepted jobs */}
                  {b.status === "ACCEPTED" && (
                    <button
                      onClick={() => shareLocation(b.id, b.isOnMyWay)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        b.isOnMyWay
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-tarea-sky text-tarea-ink hover:bg-sky-300"
                      }`}
                    >
                      <Navigation className="w-4 h-4" />
                      {b.isOnMyWay ? t("btn_on_way_done") : t("btn_on_my_way")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
