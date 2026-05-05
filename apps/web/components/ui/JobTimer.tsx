"use client";

import { useState, useEffect } from "react";
import { Play, Square, Plus, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

type ActiveBooking = {
  id: string;
  status: string;
  service: { title: string; duration: number };
  customer: { name: string };
};

type TimerState = {
  startedAt: number;
  targetMinutes: number;
  extraMinutes: number;
};

type Phase = {
  id: string;
  title: string;
  startedAt: string;
  confirmedAt: string | null;
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function PhaseList({ bookingId, phases, onPhaseAdded }: {
  bookingId: string;
  phases: Phase[];
  onPhaseAdded: (phase: Phase) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addPhase = async () => {
    if (!input.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/bookings/${bookingId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.trim() }),
    });
    if (res.ok) {
      const phase = await res.json();
      onPhaseAdded(phase);
      setInput("");
      setOpen(false);
      toast.success("Phase started — customer notified");
    } else {
      toast.error("Could not start phase");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      {/* Phase list */}
      {phases.length > 0 && (
        <div className="space-y-1.5">
          {phases.map((p) => (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${p.confirmedAt ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-400/10 border border-amber-400/20"}`}>
              {p.confirmedAt
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              <span className={`flex-1 font-medium ${p.confirmedAt ? "text-emerald-300" : "text-amber-300"}`}>
                {p.title}
              </span>
              <span className="text-xs text-slate-500">
                {p.confirmedAt ? "Confirmed ✓" : "Awaiting confirmation…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add phase toggle */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition-all text-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Start New Phase
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addPhase()}
            placeholder="e.g. Pipe inspection, Parts installation…"
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky"
          />
          <button
            onClick={addPhase}
            disabled={saving || !input.trim()}
            className="px-3 py-2 bg-tarea-sky text-tarea-ink rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-sky-300 transition-all"
          >
            {saving ? "…" : "Start"}
          </button>
          <button
            onClick={() => { setOpen(false); setInput(""); }}
            className="px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function TimerCard({ booking }: { booking: ActiveBooking }) {
  const storageKey = `timer_${booking.id}`;
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [jobStatus, setJobStatus] = useState(booking.status);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [showPhases, setShowPhases] = useState(true);

  // Restore timer from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setTimerState(JSON.parse(saved));
  }, [storageKey]);

  // Fetch existing phases
  useEffect(() => {
    fetch(`/api/bookings/${booking.id}/phases`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPhases(data); });
  }, [booking.id]);

  // Poll for phase confirmations every 15s while job is active
  useEffect(() => {
    if (!timerState) return;
    const id = setInterval(() => {
      fetch(`/api/bookings/${booking.id}/phases`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setPhases(data); });
    }, 15000);
    return () => clearInterval(id);
  }, [booking.id, timerState]);

  // Tick every second
  useEffect(() => {
    if (!timerState) return;
    const tick = () => setElapsed(Math.floor((Date.now() - timerState.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerState]);

  const save = (state: TimerState) => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    setTimerState(state);
  };

  const startJob = async () => {
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    if (!res.ok) { toast.error("Could not start job"); return; }
    save({ startedAt: Date.now(), targetMinutes: booking.service.duration, extraMinutes: 0 });
    setJobStatus("IN_PROGRESS");
    toast.success("Job started! Timer is running.");
  };

  const addTime = (minutes: number) => {
    if (!timerState) return;
    save({ ...timerState, extraMinutes: timerState.extraMinutes + minutes });
    toast.success(`+${minutes} min added to job`);
  };

  const endJob = async () => {
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (!res.ok) { toast.error("Could not end job"); return; }
    localStorage.removeItem(storageKey);
    setTimerState(null);
    setElapsed(0);
    setJobStatus("COMPLETED");
    toast.success("Job completed!");
  };

  if (jobStatus === "COMPLETED") return null;

  const totalTargetSecs = timerState
    ? (timerState.targetMinutes + timerState.extraMinutes) * 60
    : booking.service.duration * 60;
  const progress = Math.min((elapsed / totalTargetSecs) * 100, 100);
  const isOvertime = timerState && elapsed > totalTargetSecs;

  const barColor = isOvertime ? "bg-red-500" : progress > 80 ? "bg-amber-400" : "bg-tarea-sky";
  const timeColor = isOvertime ? "text-red-400" : timerState ? "text-tarea-sky" : "text-slate-500";

  const pendingPhases = phases.filter(p => !p.confirmedAt).length;

  return (
    <div className={`rounded-2xl p-5 space-y-4 border transition-all ${isOvertime ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/5"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold">{booking.service.title}</p>
          <p className="text-slate-400 text-sm">{booking.customer.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingPhases > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
              {pendingPhases} pending
            </span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${jobStatus === "IN_PROGRESS" ? "bg-tarea-sky/20 text-tarea-sky" : "bg-amber-400/20 text-amber-400"}`}>
            {jobStatus.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Clock face */}
      <div className="text-center py-2">
        <p className={`text-5xl font-mono font-bold tabular-nums tracking-tight ${timeColor}`}>
          {formatTime(elapsed)}
        </p>
        <p className="text-slate-500 text-xs mt-2">
          {timerState
            ? `Target: ${formatTime(totalTargetSecs)}${isOvertime ? " · OVERTIME" : ""}`
            : `Estimated: ${booking.service.duration} min`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${timerState ? progress : 0}%` }} />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!timerState ? (
          <button onClick={startJob}
            className="flex-1 flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-semibold py-3 rounded-xl hover:bg-sky-300 transition-all">
            <Play className="w-4 h-4 fill-current" /> Start Job
          </button>
        ) : (
          <>
            <button onClick={() => addTime(15)}
              className="flex items-center gap-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-semibold">
              <Plus className="w-3.5 h-3.5" /> 15m
            </button>
            <button onClick={() => addTime(30)}
              className="flex items-center gap-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-semibold">
              <Plus className="w-3.5 h-3.5" /> 30m
            </button>
            <button onClick={() => addTime(60)}
              className="flex items-center gap-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-semibold">
              <Plus className="w-3.5 h-3.5" /> 1h
            </button>
            <button onClick={endJob}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold py-3 rounded-xl hover:bg-red-500/30 transition-all text-sm">
              <Square className="w-4 h-4 fill-current" /> End Job
            </button>
          </>
        )}
      </div>

      {/* Phases — only visible when job is running */}
      {timerState && (
        <div className="border-t border-white/10 pt-4 space-y-3">
          <button
            onClick={() => setShowPhases(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors w-full"
          >
            <CheckCircle2 className="w-4 h-4 text-tarea-sky" />
            Job Phases
            <span className="text-slate-500 font-normal">
              ({phases.filter(p => p.confirmedAt).length}/{phases.length} confirmed)
            </span>
            {showPhases ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showPhases && (
            <PhaseList
              bookingId={booking.id}
              phases={phases}
              onPhaseAdded={p => setPhases(prev => [...prev, p])}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function JobTimerSection({ bookings }: { bookings: ActiveBooking[] }) {
  const active = bookings.filter(b => ["ACCEPTED", "IN_PROGRESS"].includes(b.status));
  if (active.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5 text-tarea-sky" />
        <h2 className="text-lg font-bold text-white">Active Jobs — Chrono</h2>
        <span className="bg-tarea-sky/20 text-tarea-sky text-xs font-semibold px-2.5 py-1 rounded-full">
          {active.length} running
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {active.map(b => <TimerCard key={b.id} booking={b} />)}
      </div>
    </div>
  );
}
