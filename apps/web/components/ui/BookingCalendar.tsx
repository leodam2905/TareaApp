"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, formatCurrency, SERVICE_CATEGORY_ICONS } from "@/lib/utils";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPrice: number;
  service: { title: string; category: string };
  customer?: { name: string };
  handyman?: { name: string };
};

const STATUS_DOT: Record<string, string> = {
  PENDING:     "bg-yellow-400",
  ACCEPTED:    "bg-tarea-sky",
  IN_PROGRESS: "bg-tarea-sky",
  COMPLETED:   "bg-emerald-400",
  CANCELLED:   "bg-slate-500",
  DISPUTED:    "bg-red-400",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:     "badge-yellow",
  ACCEPTED:    "badge-sky",
  IN_PROGRESS: "badge-sky",
  COMPLETED:   "badge-green",
  CANCELLED:   "badge-neutral",
  DISPUTED:    "badge-red",
};

interface Props {
  bookings: Booking[];
  role: "CUSTOMER" | "HANDYMAN";
  baseHref: string;
}

export default function BookingCalendar({ bookings, role, baseHref }: Props) {
  const [cur, setCur] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const { year, month } = cur;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prev = () => setCur(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  const next = () => setCur(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });

  const byDay: Record<number, Booking[]> = {};
  for (const b of bookings) {
    const d = new Date(b.scheduledAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(b);
    }
  }

  const selectedBookings = selected
    ? bookings.filter(b => {
        const d = new Date(b.scheduledAt);
        return (
          d.getFullYear() === year &&
          d.getMonth() === month &&
          d.getDate() === Number(selected)
        );
      })
    : [];

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">{monthLabel}</h2>
        <div className="flex gap-1">
          <button onClick={prev} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCur({ year: today.getFullYear(), month: today.getMonth() })}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs font-medium">
            Today
          </button>
          <button onClick={next} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-slate-500 text-xs font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dayBookings = byDay[day] ?? [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selected === String(day);
          const hasPending = dayBookings.some(b => b.status === "PENDING");

          return (
            <button
              key={day}
              onClick={() => setSelected(isSelected ? null : String(day))}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 gap-0.5 transition-all text-sm font-medium",
                isSelected ? "bg-tarea-sky text-tarea-ink" :
                isToday ? "bg-tarea-sky/20 border border-tarea-sky/40 text-white" :
                dayBookings.length > 0 ? "bg-white/5 border border-white/10 text-white hover:border-tarea-sky/30" :
                "text-slate-600 hover:text-slate-400"
              )}
            >
              <span>{day}</span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center px-1">
                  {dayBookings.slice(0, 3).map((b, i) => (
                    <span key={i} className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-tarea-ink/60" : STATUS_DOT[b.status] ?? "bg-slate-500")} />
                  ))}
                  {hasPending && !isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 border border-tarea-ink" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day bookings */}
      {selected && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400 text-sm font-semibold">
            {new Date(year, month, Number(selected)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {selectedBookings.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No bookings on this day</p>
          ) : selectedBookings.map(b => (
            <Link key={b.id} href={`${baseHref}/${b.id}`}
              className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-tarea-sky/30 transition-colors">
              <span className="text-xl">{SERVICE_CATEGORY_ICONS[b.service.category] ?? "🛠️"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{b.service.title}</p>
                <p className="text-slate-400 text-xs">
                  {new Date(b.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  {role === "CUSTOMER" ? b.handyman?.name : b.customer?.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-tarea-sky font-bold text-sm">{formatCurrency(b.totalPrice)}</p>
                <span className={STATUS_BADGE[b.status] ?? "badge"}>{b.status.replace("_", " ")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
