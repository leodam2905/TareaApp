"use client";

import { useState } from "react";
import { ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AvailabilityToggle({ initial }: { initial: boolean }) {
  const [available, setAvailable] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !available }),
      });
      if (!res.ok) throw new Error();
      setAvailable(v => !v);
      toast.success(!available ? "You're now visible to customers" : "You're now hidden from new bookings");
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
        available
          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
          : "bg-slate-500/20 border-slate-500/30 text-slate-400 hover:bg-slate-500/30"
      }`}
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : available ? (
        <ToggleRight className="w-4 h-4" />
      ) : (
        <ToggleLeft className="w-4 h-4" />
      )}
      {available ? "Available" : "Unavailable"}
    </button>
  );
}
