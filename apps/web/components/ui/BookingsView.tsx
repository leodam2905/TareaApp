"use client";

import { useState } from "react";
import Link from "next/link";
import { List, CalendarDays } from "lucide-react";
import { cn, formatCurrency, formatDate, SERVICE_CATEGORY_ICONS } from "@/lib/utils";
import BookingCalendar from "./BookingCalendar";
import PhaseConfirm from "./PhaseConfirm";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  address: string;
  city: string;
  totalPrice: number;
  notes: string | null;
  isPaid: boolean;
  isOnMyWay: boolean;
  service: { title: string; category: string };
  handyman: { name: string; avatarUrl: string | null; phone: string | null };
  customer?: { name: string };
  review: object | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "badge-yellow" },
  ACCEPTED:    { label: "Accepted",    className: "badge-sky"    },
  IN_PROGRESS: { label: "In Progress", className: "badge-sky"    },
  COMPLETED:   { label: "Completed",   className: "badge-green"  },
  CANCELLED:   { label: "Cancelled",   className: "badge-red"    },
  DISPUTED:    { label: "Disputed",    className: "badge-red"    },
};

interface Props {
  bookings: Booking[];
  role: "CUSTOMER" | "HANDYMAN";
  emptyHref: string;
  emptyLabel: string;
  baseHref: string;
}

export default function BookingsView({ bookings, role, emptyHref, emptyLabel, baseHref }: Props) {
  const [view, setView] = useState<"list" | "calendar">("list");

  if (bookings.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center flex flex-col items-center">
        <img
          src="/illustrations/empty-bookings.svg"
          alt="No bookings"
          className="w-48 h-48 object-contain mb-4 animate-[float_4s_ease-in-out_infinite]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <p className="text-white font-semibold mb-1">No bookings yet</p>
        <p className="text-slate-400 text-sm mb-5">Your booked services will appear here</p>
        <Link href={emptyHref} className="btn-secondary">{emptyLabel}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-end">
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
          <button onClick={() => setView("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === "list" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white")}>
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setView("calendar")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === "calendar" ? "bg-tarea-sky text-tarea-ink" : "text-slate-400 hover:text-white")}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <BookingCalendar bookings={bookings} role={role} baseHref={baseHref} />
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const cfg = STATUS_CONFIG[b.status] || { label: b.status, className: "badge" };
            const isActive = b.status === "IN_PROGRESS" || b.status === "ACCEPTED";
            const otherName = role === "CUSTOMER" ? b.handyman.name : (b.customer?.name ?? "Customer");
            return (
              <Link key={b.id} href={`${baseHref}/${b.id}`}
                className={cn("block border rounded-2xl p-6 transition-colors",
                  isActive ? "bg-tarea-sky/5 border-tarea-sky/20 hover:border-tarea-sky/40" : "bg-white/5 border-white/10 hover:border-tarea-sky/20")}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-14 h-14 bg-tarea-sky/10 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                    {SERVICE_CATEGORY_ICONS[b.service.category] || "🛠️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-white font-bold text-lg">{b.service.title}</h3>
                        <p className="text-slate-400 text-sm">
                          {role === "CUSTOMER" ? "Handyman" : "Customer"}: {otherName}
                        </p>
                        {role === "CUSTOMER" && b.handyman.phone && (
                          <p className="text-slate-500 text-xs mt-0.5">📞 {b.handyman.phone}</p>
                        )}
                      </div>
                      <span className={cfg.className}>{cfg.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
                      <span>📅 {formatDate(b.scheduledAt)}</span>
                      <span>📍 {b.address}, {b.city}</span>
                      <span className="text-tarea-sky font-bold">{formatCurrency(b.totalPrice)}</span>
                      {b.status === "ACCEPTED" && (
                        b.isPaid
                          ? <span className="text-emerald-400 text-xs font-semibold">✓ Paid</span>
                          : <span className="text-amber-400 text-xs font-semibold animate-pulse">💳 Payment required</span>
                      )}
                    </div>
                    {b.notes && <p className="text-slate-500 text-xs mt-2 italic">Notes: {b.notes}</p>}
                    {b.isOnMyWay && isActive && (
                      <div className="mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-400 text-sm font-semibold">
                        🚗 Handyman is on the way!
                      </div>
                    )}
                    {isActive && <div className="mt-4"><PhaseConfirm bookingId={b.id} /></div>}
                    <div className="flex gap-3 mt-3 flex-wrap">
                      {!["CANCELLED", "DISPUTED"].includes(b.status) && (
                        <Link href={`/chat/${b.id}`} onClick={e => e.stopPropagation()}
                          className="text-tarea-sky text-sm font-medium hover:underline">
                          💬 Chat
                        </Link>
                      )}
                      {b.status === "COMPLETED" && !b.review && role === "CUSTOMER" && (
                        <Link href={`${baseHref}/${b.id}/review`} onClick={e => e.stopPropagation()}
                          className="text-amber-400 text-sm font-medium hover:underline">
                          ⭐ Leave a review →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
