"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Loader2, BookOpen, Star, MessageCircle, Briefcase } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  refId: string | null;
  isRead: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  booking_request:  <BookOpen className="w-4 h-4 text-tarea-sky" />,
  booking_accepted: <Briefcase className="w-4 h-4 text-emerald-400" />,
  job_completed:    <CheckCheck className="w-4 h-4 text-emerald-400" />,
  review:           <Star className="w-4 h-4 text-amber-400" />,
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotifs(d); setLoading(false); });
  }, []);

  const markAllRead = async () => {
    setMarking(true);
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setMarking(false);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-tarea-sky" />
            {t("page_notifications")}
          </h1>
          {unreadCount > 0 && (
            <p className="text-slate-400 mt-1">{t("label_unread", { n: unreadCount })}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            {t("btn_mark_all_read")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>
      ) : notifs.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center space-y-3">
          <Bell className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-white font-semibold">{t("all_caught_up")}</p>
          <p className="text-slate-400 text-sm">{t("empty_notifs")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                n.isRead
                  ? "bg-white/3 border-white/5 opacity-70"
                  : "bg-white/7 border-white/15 hover:bg-white/10"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.isRead ? "bg-white/5" : "bg-tarea-sky/10"}`}>
                {TYPE_ICON[n.type] || <Bell className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${n.isRead ? "text-slate-400" : "text-white"}`}>{n.title}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-slate-600 text-xs mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-tarea-sky flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
