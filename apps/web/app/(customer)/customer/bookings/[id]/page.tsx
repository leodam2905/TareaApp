"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, MapPin, Calendar, DollarSign,
  MessageCircle, SendHorizontal, User, CheckCircle2, XCircle, Star, CreditCard, ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, formatDate, SERVICE_CATEGORY_ICONS } from "@/lib/utils";
import PhaseConfirm from "@/components/ui/PhaseConfirm";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "Pending",     color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  ACCEPTED:    { label: "Accepted",    color: "text-tarea-sky bg-tarea-sky/10 border-tarea-sky/30"   },
  IN_PROGRESS: { label: "In Progress", color: "text-tarea-sky bg-tarea-sky/10 border-tarea-sky/30"   },
  COMPLETED:   { label: "Completed",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  CANCELLED:   { label: "Cancelled",   color: "text-red-400 bg-red-400/10 border-red-400/30"         },
  DISPUTED:    { label: "Disputed",    color: "text-red-400 bg-red-400/10 border-red-400/30"         },
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  sender: { id: string; name: string; avatarUrl: string | null; role: string };
};

type Phase = { id: string; title: string; startedAt: string; confirmedAt: string | null };

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  address: string;
  city: string;
  notes: string | null;
  totalPrice: number;
  cancelReason: string | null;
  isPaid: boolean;
  isOnMyWay: boolean;
  handymanLat: number | null;
  handymanLng: number | null;
  service: { title: string; category: string };
  customer: { id: string; name: string; avatarUrl: string | null };
  handyman: { id: string; name: string; avatarUrl: string | null; phone: string | null };
  review: { rating: number; comment: string | null } | null;
  phases: Phase[];
  messages: Message[];
};

function Avatar({ url, name, size = 8 }: { url: string | null; name: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-tarea-sky/20 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-bold text-tarea-sky`}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadBooking = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}`);
    if (!res.ok) { router.push("/customer/bookings"); return; }
    const data = await res.json();
    setBooking(data);
    setMessages(data.messages ?? []);
  }, [id, router]);

  useEffect(() => {
    Promise.all([
      loadBooking(),
      fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUserId(d?.id ?? "")),
    ]).finally(() => setLoading(false));
  }, [loadBooking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SSE: listen for real-time chat_message events
  useEffect(() => {
    if (!currentUserId) return;
    const es = new EventSource("/api/sse");
    es.addEventListener("chat_message", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as { bookingId: string; message: Message };
        if (payload.bookingId === id) {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
        }
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [currentUserId, id]);

  // Poll location for active bookings
  useEffect(() => {
    if (!booking || !["ACCEPTED", "IN_PROGRESS"].includes(booking.status)) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/bookings/${id}/location`);
      if (res.ok) {
        const loc = await res.json();
        setBooking(prev => prev ? { ...prev, isOnMyWay: loc.isOnMyWay, handymanLat: loc.lat, handymanLng: loc.lng } : prev);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [id, booking?.status]);

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    const res = await fetch(`/api/bookings/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msgText.trim() }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setMsgText("");
    } else {
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  const startPayment = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setPaying(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (status === "CANCELLED" && !confirm("Cancel this booking?")) return;
    setActing(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBooking(prev => prev ? { ...prev, status: updated.status } : prev);
      toast.success(`Booking ${status.toLowerCase()}`);
    } else {
      toast.error("Action failed");
    }
    setActing(false);
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>;
  }
  if (!booking) return null;

  const cfg = STATUS_CONFIG[booking.status] ?? { label: booking.status, color: "text-slate-400 bg-slate-400/10 border-slate-400/30" };
  const isActive = ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(booking.status);
  const canCancel = ["PENDING", "ACCEPTED"].includes(booking.status);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/customer/bookings")}
          className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-white">{booking.service.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Booking #{booking.id.slice(-8).toUpperCase()}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* On-the-way banner */}
      {booking.isOnMyWay && isActive && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3">
          <span className="text-xl">🚗</span>
          <div>
            <p className="text-emerald-400 font-bold text-sm">Your handyman is on the way!</p>
            <p className="text-emerald-600 text-xs">They will arrive shortly at your location.</p>
          </div>
        </div>
      )}

      {/* Booking info card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-tarea-sky/10 rounded-2xl flex items-center justify-center text-2xl">
            {SERVICE_CATEGORY_ICONS[booking.service.category] || "🛠️"}
          </div>
          <div className="flex-1">
            <p className="text-white font-bold">{booking.service.title}</p>
            <p className="text-slate-400 text-sm">{booking.service.category.replace("_", " ")}</p>
          </div>
          <div className="text-right">
            <p className="text-tarea-sky font-bold text-xl">{formatCurrency(booking.totalPrice)}</p>
            {booking.isPaid
              ? <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-1 justify-end"><ShieldCheck className="w-3.5 h-3.5" /> Paid</span>
              : <span className="text-xs text-amber-400 font-semibold mt-1 block">Awaiting payment</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 text-tarea-sky" />
            {formatDate(booking.scheduledAt)}
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-4 h-4 text-tarea-sky" />
            {booking.city}
          </div>
          <div className="col-span-2 text-slate-500 text-xs">{booking.address}</div>
        </div>

        {booking.notes && (
          <p className="text-slate-500 text-sm italic border-t border-white/5 pt-3">📝 {booking.notes}</p>
        )}

        {booking.cancelReason && (
          <p className="text-red-400 text-sm border-t border-white/5 pt-3">
            Cancellation reason: {booking.cancelReason}
          </p>
        )}
      </div>

      {/* Handyman card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
        <Avatar url={booking.handyman.avatarUrl} name={booking.handyman.name} size={12} />
        <div className="flex-1">
          <p className="text-white font-bold">{booking.handyman.name}</p>
          {booking.handyman.phone && (
            <p className="text-slate-400 text-sm">📞 {booking.handyman.phone}</p>
          )}
        </div>
        {booking.review && (
          <div className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
            <Star className="w-4 h-4 fill-current" />
            {booking.review.rating}/5
          </div>
        )}
      </div>

      {/* Phases */}
      {isActive && <PhaseConfirm bookingId={booking.id} />}

      {/* Actions */}
      {/* Pay Now — shown for ACCEPTED and not yet paid */}
      {booking.status === "ACCEPTED" && !booking.isPaid && (
        <button
          onClick={startPayment}
          disabled={paying}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-4 rounded-2xl hover:bg-sky-300 transition-all disabled:opacity-50 text-base"
        >
          {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          {paying ? "Redirecting to payment…" : `Pay ${formatCurrency(booking.totalPrice)} to Confirm`}
        </button>
      )}

      {(canCancel || (booking.status === "COMPLETED" && !booking.review)) && (
        <div className="flex gap-3">
          {canCancel && (
            <button onClick={() => changeStatus("CANCELLED")} disabled={acting}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-400/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-400/10 transition-all disabled:opacity-50">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel Booking
            </button>
          )}
          {booking.status === "COMPLETED" && !booking.review && (
            <Link href={`/customer/bookings/${booking.id}/review`}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-xl text-sm font-semibold hover:bg-amber-400/20 transition-all">
              <Star className="w-4 h-4" /> Leave a Review
            </Link>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
          <MessageCircle className="w-4 h-4 text-tarea-sky" />
          <p className="text-white font-semibold text-sm">Messages</p>
          <span className="ml-auto text-slate-500 text-xs">{messages.length} messages</span>
        </div>

        <div className="h-72 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(m => {
              const isMine = m.sender.id === currentUserId;
              return (
                <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <Avatar url={m.sender.avatarUrl} name={m.sender.name} size={7} />
                  <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm ${
                      isMine
                        ? "bg-tarea-sky text-tarea-ink rounded-tr-sm"
                        : "bg-white/10 text-white rounded-tl-sm"
                    }`}>
                      {m.content}
                    </div>
                    <span className="text-slate-600 text-[10px] px-1">{formatTime(m.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {!["CANCELLED", "DISPUTED", "COMPLETED"].includes(booking.status) && (
          <div className="flex gap-2 p-3 border-t border-white/10">
            <input
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Type a message…"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
            />
            <button onClick={sendMessage} disabled={sending || !msgText.trim()}
              className="w-10 h-10 bg-tarea-sky text-tarea-ink rounded-xl flex items-center justify-center hover:bg-sky-300 transition-all disabled:opacity-40">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
