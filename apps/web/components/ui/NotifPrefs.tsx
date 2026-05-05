"use client";

import { useState, useEffect } from "react";
import { Bell, MessageSquare, Clock, Smartphone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type Prefs = {
  notifBookingUpdates: boolean;
  notifReminders: boolean;
  notifMessages: boolean;
  notifSms: boolean;
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-tarea-sky" : "bg-white/10"}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

export default function NotifPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then(r => r.json())
      .then(d => setPrefs(d))
      .catch(() => {});
  }, []);

  const update = async (key: keyof Prefs, val: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    setSaving(true);
    const res = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    });
    setSaving(false);
    if (!res.ok) toast.error("Failed to save preference");
  };

  if (!prefs) return null;

  const rows = [
    { key: "notifBookingUpdates" as const, label: "Booking updates", sub: "Accepted, cancelled, completed", icon: Bell },
    { key: "notifReminders" as const,      label: "Reminders",        sub: "24h and 1h before appointments", icon: Clock },
    { key: "notifMessages" as const,       label: "Chat messages",    sub: "New messages from the other party", icon: MessageSquare },
    { key: "notifSms" as const,            label: "SMS alerts",       sub: "Text for key booking events (requires phone)", icon: Smartphone },
  ];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-tarea-sky" /> Notification Preferences
        </h2>
        {saving && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
      </div>
      <div className="space-y-3">
        {rows.map(({ key, label, sub, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-slate-500 text-xs">{sub}</p>
              </div>
            </div>
            <Toggle on={prefs[key]} onChange={val => update(key, val)} />
          </div>
        ))}
      </div>
    </div>
  );
}
