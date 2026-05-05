"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import toast from "react-hot-toast";

type Phase = {
  id: string;
  title: string;
  startedAt: string;
  confirmedAt: string | null;
};

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

export default function PhaseConfirm({ bookingId }: { bookingId: string }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/bookings/${bookingId}/phases`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPhases(data); });
  }, [bookingId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const confirm = async (phaseId: string, title: string) => {
    setConfirming(phaseId);
    const res = await fetch(`/api/bookings/${bookingId}/phases/${phaseId}`, {
      method: "PATCH",
    });
    if (res.ok) {
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, confirmedAt: new Date().toISOString() } : p));
      toast.success(`"${title}" confirmed!`);
    } else {
      toast.error("Could not confirm phase");
    }
    setConfirming(null);
  };

  if (phases.length === 0) return null;

  const pending = phases.filter(p => !p.confirmedAt);
  const done = phases.filter(p => p.confirmedAt);

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${pending.length > 0 ? "border-amber-400/30 bg-amber-400/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
      <div className="flex items-center gap-2">
        <Clock className={`w-4 h-4 ${pending.length > 0 ? "text-amber-400" : "text-emerald-400"}`} />
        <p className="text-sm font-semibold text-white">
          Job Phases
          <span className="ml-2 font-normal text-slate-400">
            {done.length}/{phases.length} confirmed
          </span>
        </p>
        {pending.length > 0 && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400">
            {pending.length} need your confirmation
          </span>
        )}
      </div>

      <div className="space-y-2">
        {phases.map(p => (
          <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${p.confirmedAt ? "bg-emerald-500/10" : "bg-amber-400/10"}`}>
            {p.confirmedAt
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <Circle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${p.confirmedAt ? "text-emerald-300" : "text-amber-300"}`}>
                {p.title}
              </p>
              <p className="text-xs text-slate-500">
                Started {formatRelative(p.startedAt)}
                {p.confirmedAt && ` · Confirmed ${formatRelative(p.confirmedAt)}`}
              </p>
            </div>
            {!p.confirmedAt && (
              <button
                onClick={() => confirm(p.id, p.title)}
                disabled={confirming === p.id}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-400 text-tarea-ink text-xs font-bold hover:bg-amber-300 transition-all disabled:opacity-50"
              >
                {confirming === p.id ? "…" : "Confirm"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
