"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmt(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

type Slot = { dayOfWeek: number; startHour: number; endHour: number };

export default function HandymanSchedulePage() {
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [slots, setSlots] = useState<Record<number, Slot>>(
    Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, { dayOfWeek: d, startHour: 6, endHour: 20 }]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/handyman/availability")
      .then(r => r.json())
      .then((data: Slot[]) => {
        if (data.length > 0) {
          const active = new Set(data.map(s => s.dayOfWeek));
          setActiveDays(active);
          const map: Record<number, Slot> = {};
          for (const s of data) map[s.dayOfWeek] = s;
          setSlots(prev => ({ ...prev, ...map }));
        }
        setLoading(false);
      });
  }, []);

  const toggleDay = (d: number) => {
    setActiveDays(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  const setHour = (day: number, field: "startHour" | "endHour", val: number) => {
    setSlots(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));
  };

  const save = async () => {
    setSaving(true);
    const payload = Array.from(activeDays).map(d => slots[d]).filter(Boolean);
    const res = await fetch("/api/handyman/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: payload }),
    });
    setSaving(false);
    if (res.ok) toast.success("Schedule saved!");
    else toast.error("Failed to save schedule");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Weekly Schedule</h1>
          <p className="text-slate-400 mt-1">Set the days and hours you're available for bookings</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-bold px-5 py-2.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Day toggle pills */}
      <div className="flex gap-2 flex-wrap">
        {DAYS.map((label, d) => (
          <button
            key={d}
            onClick={() => toggleDay(d)}
            className={cn(
              "w-14 h-14 rounded-2xl text-sm font-bold transition-all",
              activeDays.has(d)
                ? "bg-tarea-sky text-tarea-ink shadow-card"
                : "bg-white/5 border border-white/10 text-slate-400 hover:border-tarea-sky/30"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-day time selectors */}
      <div className="space-y-3">
        {DAYS.map((label, d) => {
          if (!activeDays.has(d)) return null;
          const slot = slots[d];
          return (
            <div key={d} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
              <div className="w-10 text-center">
                <p className="text-white font-bold text-sm">{label}</p>
              </div>
              <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1">
                  <label className="text-slate-500 text-xs block mb-1">Start</label>
                  <select
                    value={slot.startHour}
                    onChange={e => setHour(d, "startHour", Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-tarea-sky"
                  >
                    {HOURS.slice(0, 22).map(h => (
                      <option key={h} value={h} className="bg-[#0F172A]">{fmt(h)}</option>
                    ))}
                  </select>
                </div>
                <span className="text-slate-500 flex-shrink-0 mt-4">→</span>
                <div className="flex-1">
                  <label className="text-slate-500 text-xs block mb-1">End</label>
                  <select
                    value={slot.endHour}
                    onChange={e => setHour(d, "endHour", Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-tarea-sky"
                  >
                    {HOURS.slice(1).map(h => (
                      <option key={h} value={h} disabled={h <= slot.startHour} className="bg-[#0F172A]">
                        {fmt(h)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-tarea-sky text-xs font-semibold">
                  {slot.endHour - slot.startHour}h
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {activeDays.size === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center">
          <p className="text-amber-400 font-semibold">No days selected</p>
          <p className="text-slate-400 text-sm mt-1">Customers won't be able to book you until you enable at least one day.</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-slate-400 text-sm font-semibold mb-3">Your weekly availability summary</p>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((label, d) => {
            const active = activeDays.has(d);
            const slot = slots[d];
            return (
              <div key={d} className={cn("rounded-xl p-2 text-center", active ? "bg-tarea-sky/10 border border-tarea-sky/20" : "bg-white/5")}>
                <p className={cn("text-xs font-bold", active ? "text-tarea-sky" : "text-slate-600")}>{label}</p>
                {active && (
                  <p className="text-slate-400 text-[10px] mt-1 leading-tight">
                    {fmt(slot.startHour)}–{fmt(slot.endHour)}
                  </p>
                )}
                {!active && <p className="text-slate-700 text-[10px] mt-1">Off</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
