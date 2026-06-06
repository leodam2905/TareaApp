"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Loader2, BookOpen, Star, MessageCircle, Briefcase, Wrench } from "lucide-react";
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

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  booking_request:  { icon: <BookOpen className="w-4 h-4" />,      color: "text-tarea-sky",   bg: "bg-tarea-sky/15"   },
  booking_accepted: { icon: <Briefcase className="w-4 h-4" />,     color: "text-emerald-400", bg: "bg-emerald-400/15" },
  job_completed:    { icon: <CheckCheck className="w-4 h-4" />,    color: "text-emerald-400", bg: "bg-emerald-400/15" },
  review:           { icon: <Star className="w-4 h-4" />,          color: "text-amber-400",   bg: "bg-amber-400/15"   },
  message:          { icon: <MessageCircle className="w-4 h-4" />, color: "text-violet-400",  bg: "bg-violet-400/15"  },
  job_assigned:     { icon: <Wrench className="w-4 h-4" />,        color: "text-tarea-sky",   bg: "bg-tarea-sky/15"   },
};

const DEFAULT_META = { icon: <Bell className="w-4 h-4" />, color: "text-slate-400", bg: "bg-white/10" };

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-3">
            <Bell className="w-7 h-7 text-tarea-sky" />
            {t("page_notifications")}
          </h1>
          {unreadCount > 0 && (
            <p className="text-[var(--text-muted)] mt-1 text-sm">
              {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg-alt)] transition-all text-sm font-medium"
          >
            {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-16 text-center space-y-3">
          <div className="w-14 h-14 bg-[var(--card-bg-alt)] rounded-2xl flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6 text-[var(--text-subtle)]" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold">You&apos;re all caught up</p>
          <p className="text-[var(--text-muted)] text-sm">No new notifications right now.</p>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden divide-y divide-[var(--card-border)]">
          {notifs.map(n => {
            const meta = TYPE_META[n.type] ?? DEFAULT_META;
            return (
              <div
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                className={`flex items-start gap-4 px-5 py-4 transition-all cursor-pointer hover:bg-[var(--card-bg-alt)] ${
                  !n.isRead ? "bg-tarea-sky/[0.04]" : ""
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.color}`}>
                  {meta.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${n.isRead ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                    {n.title}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[var(--text-subtle)] text-xs mt-1.5">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Unread dot */}
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-tarea-sky flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
