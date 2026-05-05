"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";

type Setting = { id: string; key: string; value: string; label: string };

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(data => {
      setSettings(data);
      const map: Record<string, string> = {};
      data.forEach((s: Setting) => { map[s.key] = s.value; });
      setValues(map);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) toast.success("Settings saved");
    else toast.error("Failed to save");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Platform Settings</h1>
        <p className="text-slate-400 mt-1">Configure fees, limits, and defaults</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : settings.map(s => (
          <div key={s.key}>
            <label className="block text-slate-300 text-sm font-semibold mb-1.5">{s.label}</label>
            <input
              type="text"
              value={values[s.key] ?? ""}
              onChange={e => setValues(prev => ({ ...prev, [s.key]: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-tarea-sky"
            />
            <p className="text-slate-500 text-xs mt-1 font-mono">{s.key}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
        <strong>Note:</strong> Fee rate changes take effect on new bookings only. The app currently reads fees from <code>lib/fees.ts</code> — update those constants after adjusting settings here to keep them in sync.
      </div>

      <button
        onClick={save}
        disabled={saving || loading}
        className="flex items-center gap-2 px-6 py-3 bg-tarea-sky text-tarea-ink font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}
