"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cld } from "@/lib/cld";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, MapPin, Calendar, DollarSign,
  MessageCircle, SendHorizontal, User, CheckCircle2, XCircle, Star, CreditCard, ShieldCheck, ShieldAlert, Sparkles, FileText, RefreshCw, Camera
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import PhaseConfirm from "@/components/ui/PhaseConfirm";
import LiveTrackingMap from "@/components/ui/LiveTrackingMap";

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
  materialsEstimate: number;
  materialsRefunded?: number | null;
  cancelReason: string | null;
  isPaid: boolean;
  workDoneAt: string | null;
  receiptUrl: string | null;
  isOnMyWay: boolean;
  handymanLat: number | null;
  handymanLng: number | null;
  service: { title: string; category: string };
  customer: { id: string; name: string; avatarUrl: string | null };
  handyman: { id: string; name: string; avatarUrl: string | null };
  canCall: boolean;
  review: { rating: number; comment: string | null } | null;
  phases: Phase[];
  messages: Message[];
};

function Avatar({ url, name, size = 8 }: { url: string | null; name: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-tarea-sky/20 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-bold text-tarea-sky`}>
      {url ? <img src={cld(url)} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
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
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [disputeStatement, setDisputeStatement] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeAnalysis, setDisputeAnalysis] = useState<{ summary: string; recommendation: string; priority: string } | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rebooking, setRebooking] = useState(false);
  const [rebookModalOpen, setRebookModalOpen] = useState(false);
  const [rebookDate, setRebookDate] = useState("");
  const [rebookTime, setRebookTime] = useState("09:00");

  // Masked calling: ask the server for the proxy number that reaches the pro,
  // then hand it to the dialer. The pro's real number never reaches the browser.
  const startCall = async () => {
    const res = await fetch(`/api/bookings/${id}/call`, { method: "POST" });
    if (!res.ok) {
      toast.error(
        res.status === 422
          ? "Add a phone number to your profile to place calls."
          : "Calling isn't available right now. Try the chat instead."
      );
      return;
    }
    const { proxyNumber } = await res.json();
    window.location.href = `tel:${proxyNumber}`;
  };

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

  // Auto-redirect to payment when booking is accepted but unpaid
  useEffect(() => {
    if (!booking || booking.isPaid || booking.status !== "ACCEPTED") return;
    if (!currentUserId || booking.customer.id !== currentUserId) return;

    setPaying(true);
    toast.loading("Booking accepted — redirecting to payment…", { id: "auto-pay" });
    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.url) {
          toast.dismiss("auto-pay");
          window.location.href = d.url;
        } else {
          toast.error(d.error ?? "Could not start payment", { id: "auto-pay" });
          setPaying(false);
        }
      })
      .catch(() => {
        toast.error("Could not start payment", { id: "auto-pay" });
        setPaying(false);
      });
  }, [booking?.status, booking?.isPaid, currentUserId]);

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

  const submitDispute = async () => {
    if (!disputeStatement.trim()) { toast.error("Please describe your issue"); return; }
    setDisputeSubmitting(true);
    const res = await fetch("/api/ai/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id, customerStatement: disputeStatement }),
    });
    if (res.ok) {
      const { analysis } = await res.json();
      setDisputeAnalysis(analysis);
      toast.success("Dispute submitted. Our team will review it shortly.");
    } else {
      toast.error("Failed to submit dispute");
    }
    setDisputeSubmitting(false);
  };

  const changeStatus = async (status: string, reason?: string) => {
    setActing(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelReason: reason }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBooking(prev => prev ? { ...prev, status: updated.status, cancelReason: reason ?? prev.cancelReason } : prev);
      toast.success(`Booking ${status.toLowerCase()}`);
    } else {
      toast.error("Action failed");
    }
    setActing(false);
  };

  const uploadReceipt = async (file: File) => {
    setUploadingReceipt(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "tarea/receipts");
    const res = await fetch("/api/upload/image", { method: "POST", body: fd });
    if (res.ok) { const { url } = await res.json(); setReceiptUrl(url); }
    else toast.error("Upload failed");
    setUploadingReceipt(false);
  };

  const confirmCompletion = async () => {
    setActing(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", ...(receiptUrl ? { receiptUrl } : {}) }),
    });
    if (res.ok) {
      setBooking(prev => prev ? { ...prev, status: "COMPLETED" } : prev);
      toast.success("Completed — payment released to your pro.");
    } else {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error || "Could not confirm");
    }
    setActing(false);
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) { toast.error("Please provide a cancellation reason"); return; }
    setCancelModalOpen(false);
    await changeStatus("CANCELLED", cancelReason.trim());
    setCancelReason("");
  };

  const confirmRebook = async () => {
    if (!booking || !rebookDate) return;
    const scheduledAt = new Date(`${rebookDate}T${rebookTime}`);
    if (isNaN(scheduledAt.getTime())) { toast.error("Invalid date"); return; }
    setRebooking(true);
    setRebookModalOpen(false);
    try {
      const res = await fetch(`/api/bookings/${id}/repeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to rebook");
      const newBooking = await res.json();
      toast.success("New booking created!");
      router.push(`/customer/bookings/${newBooking.id}`);
    } catch {
      toast.error("Rebook failed. Please try again.");
      setRebooking(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>;
  }
  if (!booking) return null;

  const cfg = STATUS_CONFIG[booking.status] ?? { label: booking.status, color: "text-slate-400 bg-tarea-ink-subtle/10 border-slate-400/30" };
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

      {/* On-the-way banner + live map */}
      {booking.isOnMyWay && isActive && (
        <>
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3">
            <span className="text-xl">🚗</span>
            <div>
              <p className="text-emerald-400 font-bold text-sm">Your handyman is on the way!</p>
              <p className="text-emerald-600 text-xs">They will arrive shortly at your location.</p>
            </div>
          </div>
          {booking.handymanLat && booking.handymanLng && (
            <LiveTrackingMap
              lat={booking.handymanLat}
              lng={booking.handymanLng}
              destinationAddress={booking.address}
            />
          )}
        </>
      )}

      {/* Booking info card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-tarea-sky/10 rounded-2xl flex items-center justify-center">
            <CategoryIcon catKey={booking.service.category} active className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold">{booking.service.title}</p>
            <p className="text-slate-400 text-sm">{booking.service.category.replace("_", " ")}</p>
          </div>
          <div className="text-right">
            <p className="text-tarea-sky font-bold text-xl">
              {formatCurrency(
                booking.totalPrice * 1.15 + (booking.materialsEstimate ?? 0) - (booking.materialsRefunded ?? 0),
              )}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              Labor {formatCurrency(booking.totalPrice)} + 15% fee
            </p>
            {(booking.materialsEstimate ?? 0) > 0 && (
              <p className="text-slate-500 text-xs">
                🔩 Materials ~{formatCurrency(booking.materialsEstimate)}
              </p>
            )}
            {(booking.materialsRefunded ?? 0) > 0 && (
              <p className="text-emerald-400 text-xs">
                ↩ {formatCurrency(booking.materialsRefunded!)} materials refunded
              </p>
            )}
            {booking.isPaid ? (
              <div className="flex flex-col items-end gap-1 mt-1">
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><ShieldCheck className="w-3.5 h-3.5" /> Paid</span>
                <Link href={`/customer/bookings/${booking.id}/invoice`} target="_blank"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-tarea-sky transition-colors">
                  <FileText className="w-3 h-3" /> Invoice
                </Link>
              </div>
            ) : (
              <span className="text-xs text-amber-400 font-semibold mt-1 block">Awaiting payment</span>
            )}
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
          {booking.canCall && (
            <button onClick={startCall} className="text-slate-400 hover:text-white text-sm">
              📞 Call {booking.handyman.name.split(" ")[0]}
            </button>
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
          {paying ? "Redirecting to payment…" : `Pay ${formatCurrency(booking.totalPrice * 1.15 + (booking.materialsEstimate ?? 0))} to Confirm`}
        </button>
      )}

      {booking.status === "IN_PROGRESS" && booking.workDoneAt && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 space-y-3">
          <div>
            <p className="font-extrabold text-gray-900">Job finished?</p>
            <p className="text-sm text-gray-600 mt-0.5">Your pro marked the work done. Confirm to release payment — it auto-confirms in 3 days.</p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 cursor-pointer hover:border-emerald-400 transition-colors">
            {receiptUrl ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Camera className="w-5 h-5 text-gray-400" />}
            <span className="text-sm font-semibold text-gray-800">{receiptUrl ? "Receipt added" : "Add materials receipt (optional)"}</span>
            {uploadingReceipt && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />}
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); e.target.value = ""; }} />
          </label>
          <button onClick={confirmCompletion} disabled={acting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-all disabled:opacity-50">
            {acting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Confirm &amp; release payment
          </button>
        </div>
      )}

      {(canCancel || booking.status === "COMPLETED") && (
        <div className="flex gap-3">
          {canCancel && (
            <button onClick={() => setCancelModalOpen(true)} disabled={acting}
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
          {booking.status === "COMPLETED" && (
            <button
              onClick={() => setRebookModalOpen(true)}
              disabled={rebooking}
              className="flex items-center gap-2 px-4 py-2.5 bg-tarea-sky/10 border border-tarea-sky/30 text-tarea-sky rounded-xl text-sm font-semibold hover:bg-tarea-sky/20 transition-all disabled:opacity-50"
            >
              {rebooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Rebook
            </button>
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

      {/* Dispute Helper */}
      {booking.status === "DISPUTED" && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <p className="text-white font-semibold">Dispute Filed</p>
          </div>

          {disputeAnalysis ? (
            <div className="space-y-3">
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">{disputeAnalysis.summary}</p>
                <p className="text-tarea-sky text-sm"><span className="font-semibold text-white">Recommendation: </span>{disputeAnalysis.recommendation}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  disputeAnalysis.priority === "high" ? "bg-red-400/20 text-red-400" :
                  disputeAnalysis.priority === "medium" ? "bg-amber-400/20 text-amber-400" :
                  "bg-tarea-ink-subtle/20 text-slate-400"
                }`}>
                  {disputeAnalysis.priority.toUpperCase()} PRIORITY
                </span>
              </div>
              <p className="text-slate-500 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> AI-assisted analysis sent to our support team. We'll reach out within 24–48 hours.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Describe the issue with this booking. Our AI will analyze your statement and route it to the right support agent.</p>
              <textarea
                value={disputeStatement}
                onChange={e => setDisputeStatement(e.target.value)}
                placeholder="What went wrong? Describe the issue in detail…"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-red-400/50 resize-none"
              />
              <button
                onClick={submitDispute}
                disabled={disputeSubmitting || !disputeStatement.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40"
              >
                {disputeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                {disputeSubmitting ? "Submitting…" : "Submit Dispute Statement"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rebook modal */}
      {rebookModalOpen && booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-tarea-ink border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-tarea-sky/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-tarea-sky" />
              </div>
              <div>
                <h2 className="text-white font-bold">Book Again</h2>
                <p className="text-slate-400 text-sm">{booking.service.title} with {booking.handyman.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">New date</label>
                <input
                  type="date"
                  value={rebookDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setRebookDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-tarea-sky"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">Preferred time</label>
                <select
                  value={rebookTime}
                  onChange={e => setRebookTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-tarea-sky"
                >
                  {[8,9,10,11,12,13,14,15,16,17,18,19].map(h => (
                    <option key={h} value={`${String(h).padStart(2,"0")}:00`}>
                      {h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h-12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3 text-sm text-slate-400">
              <p>Same address: <span className="text-white">{booking.address}, {booking.city}</span></p>
              <p className="mt-1">Price: <span className="text-tarea-sky font-semibold">{formatCurrency(booking.totalPrice)}</span></p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRebookModalOpen(false)}
                className="flex-1 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmRebook}
                disabled={!rebookDate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-tarea-sky text-tarea-ink rounded-xl text-sm font-bold hover:bg-sky-300 transition-all disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4" />
                Confirm Rebook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel booking modal */}
      {cancelModalOpen && booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-tarea-ink border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-bold">Cancel Booking</h2>
                <p className="text-slate-400 text-sm">This action cannot be undone</p>
              </div>
            </div>

            {/* Fee warning */}
            {booking.isPaid && (() => {
              const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
              return hoursUntil < 24 ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-1">
                  <p className="text-amber-400 font-semibold text-sm">⚠ Late cancellation fee applies</p>
                  <p className="text-amber-500/80 text-xs">
                    Since you're cancelling within 24 hours of the scheduled time, a 50% cancellation fee applies.
                    You'll receive a partial refund of {formatCurrency(booking.totalPrice * 1.15 * 0.5)} within 5–10 business days.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-1">
                  <p className="text-emerald-400 font-semibold text-sm">✓ Full refund</p>
                  <p className="text-emerald-600/80 text-xs">
                    You'll receive a full refund of {formatCurrency(booking.totalPrice * 1.15)} within 5–10 business days.
                  </p>
                </div>
              );
            })()}

            {/* Reason input */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">Reason for cancellation</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Please tell us why you're cancelling…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-red-400/50 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModalOpen(false); setCancelReason(""); }}
                className="flex-1 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/5 transition-all"
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancel}
                disabled={acting || !cancelReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {acting ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
