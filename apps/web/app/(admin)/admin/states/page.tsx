"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, CheckCircle2, XCircle, Loader2, Globe } from "lucide-react";
import toast from "react-hot-toast";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "Washington D.C.",
};

type StateRow = { state: string; isActive: boolean; activatedAt: string | null };

export default function StatesPage() {
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/states")
      .then((r) => r.json())
      .then(setStates)
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (state: string, current: boolean) => {
    setToggling(state);
    try {
      const res = await fetch("/api/admin/states", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, isActive: !current }),
      });
      if (!res.ok) throw new Error();
      const updated: StateRow = await res.json();
      setStates((prev) => prev.map((s) => (s.state === state ? updated : s)));
      toast.success(`${STATE_NAMES[state]} ${!current ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update state");
    } finally {
      setToggling(null);
    }
  };

  const activeCount = states.filter((s) => s.isActive).length;
  const filtered = states.filter(
    (s) =>
      s.state.toLowerCase().includes(search.toLowerCase()) ||
      STATE_NAMES[s.state]?.toLowerCase().includes(search.toLowerCase())
  );

  const activateAll = async () => {
    const inactive = states.filter((s) => !s.isActive);
    for (const s of inactive) await toggle(s.state, false);
  };

  const deactivateAll = async () => {
    const active = states.filter((s) => s.isActive);
    for (const s of active) await toggle(s.state, true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-red-400" />
            State Coverage
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Control which states customers and handymen can register and operate in
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={deactivateAll}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10 transition-all"
          >
            Deactivate All
          </button>
          <button
            onClick={activateAll}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all"
          >
            Activate All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Active States</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Inactive States</p>
          <p className="text-3xl font-bold text-slate-300 mt-1">{states.length - activeCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm">Total Coverage</p>
          <p className="text-3xl font-bold text-white mt-1">
            {states.length > 0 ? Math.round((activeCount / states.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search states..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
      />

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((s) => (
            <motion.button
              key={s.state}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(s.state, s.isActive)}
              disabled={toggling === s.state}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all duration-200 ${
                s.isActive
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {toggling === s.state ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : s.isActive ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <span className="text-lg font-bold">{s.state}</span>
              <span className="text-xs leading-tight opacity-75">{STATE_NAMES[s.state]}</span>
              {s.isActive && s.activatedAt && (
                <span className="text-[10px] text-emerald-500/70 mt-1">
                  Since {new Date(s.activatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <p className="text-slate-500 text-xs flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" />
        Inactive states block new registrations and hide handymen from browse. Existing accounts are not affected.
      </p>
    </div>
  );
}
