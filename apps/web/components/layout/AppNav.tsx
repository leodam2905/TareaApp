"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, LayoutDashboard, Search, CalendarCheck, User, Briefcase, DollarSign, LogOut, Bell, ClipboardList, Radar, Layers, CalendarDays, X, CheckCheck, Heart, Sun, Moon, Wallet, Gift, PieChart, HelpCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { useT } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

interface NavProps {
  role: "CUSTOMER" | "HANDYMAN";
  userName: string;
}

export default function AppNav({ role, userName }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { theme, toggle } = useTheme();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; isRead: boolean; type: string; refId: string | null; createdAt: string }[]>([]);
  const bellRef = useRef<HTMLButtonElement>(null);

  const customerLinks = [
    { href: "/customer/dashboard",  label: t("nav_dashboard"),   icon: LayoutDashboard },
    { href: "/customer/browse",     label: t("nav_browse"),       icon: Search          },
    { href: "/customer/bookings",   label: t("nav_bookings"),     icon: CalendarCheck   },
    { href: "/customer/favorites",  label: "Favorites",           icon: Heart           },
    { href: "/customer/requests",   label: t("nav_requests"),     icon: ClipboardList   },
    { href: "/customer/post-job",   label: t("nav_post_job"),     icon: Briefcase       },
    { href: "/customer/spending",    label: "Spending Report",     icon: PieChart        },
    { href: "/customer/referrals",  label: "Refer & Earn",        icon: Gift            },
    { href: "/customer/profile",    label: t("nav_profile"),      icon: User            },
  ];

  const handymanLinks = [
    { href: "/handyman/dashboard",  label: t("nav_dashboard"),   icon: LayoutDashboard },
    { href: "/handyman/find-jobs",  label: t("nav_find_jobs"),   icon: Radar           },
    { href: "/handyman/jobs",       label: t("nav_my_jobs"),     icon: Briefcase       },
    { href: "/handyman/services",   label: t("nav_services"),    icon: Layers          },
    { href: "/handyman/earnings",        label: t("nav_earnings"),    icon: DollarSign  },
    { href: "/handyman/payout-methods", label: "Payout Methods",    icon: Wallet      },
    { href: "/handyman/schedule",        label: "Schedule",          icon: CalendarDays },
    { href: "/handyman/referrals",       label: "Refer & Earn",      icon: Gift        },
    { href: "/handyman/profile",         label: t("nav_profile"),    icon: User        },
  ];

  const links = role === "CUSTOMER" ? customerLinks : handymanLinks;

  const loadNotifs = () => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) return;
        setNotifs(d.slice(0, 8));
        setUnread(d.filter((n: { isRead: boolean }) => !n.isRead).length);
      });
  };

  useEffect(() => {
    loadNotifs();

    const es = new EventSource("/api/sse");
    es.addEventListener("unread", (e) => {
      const { count } = JSON.parse((e as MessageEvent).data);
      setUnread(count);
    });
    es.addEventListener("notification", () => {
      setUnread(prev => prev + 1);
      loadNotifs();
    });
    return () => es.close();
  }, []);

  const openBell = () => {
    setNotifOpen(o => !o);
    loadNotifs();
  };

  const markAllRead = async () => {
    if (!unread) return;
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
    setUnread(0);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t("toast_signed_out"));
    router.push("/");
  };

  return (
    <nav className="h-screen w-64 bg-tarea-ink border-r border-white/10 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-hero-gradient rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Tarea</span>
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-tarea-sky rounded-full flex items-center justify-center text-tarea-ink font-bold text-sm">
            {userName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-semibold truncate max-w-[130px]">{userName}</p>
            <span className="badge-sky text-xs">{role}</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 4 }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                  active
                    ? "bg-tarea-sky text-tarea-ink shadow-card"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
                {active && (
                  <motion.div layoutId="nav-active" className="ml-auto w-1.5 h-1.5 rounded-full bg-tarea-ink" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t border-white/10 space-y-1">
        {/* Notification bell with dropdown */}
        <div className="relative">
          <button
            ref={bellRef}
            onClick={openBell}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            {t("nav_notifications")}
          </button>

          {notifOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-white font-bold text-sm">Notifications</p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-tarea-sky text-xs flex items-center gap-1 hover:underline">
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No notifications yet</p>
                ) : notifs.map(n => (
                  <Link
                    key={n.id}
                    href={n.type === "message" ? `/chat/${n.refId}` : n.refId ? `/customer/bookings/${n.refId}` : "/notifications"}
                    onClick={() => setNotifOpen(false)}
                    className={cn(
                      "block px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors",
                      !n.isRead && "bg-tarea-sky/5"
                    )}
                  >
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-tarea-sky inline-block mr-2 mb-0.5" />}
                    <p className={cn("text-sm font-semibold", n.isRead ? "text-slate-300" : "text-white")}>{n.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{n.body}</p>
                  </Link>
                ))}
              </div>
              <Link href="/notifications" onClick={() => setNotifOpen(false)}
                className="block text-center text-tarea-sky text-xs font-medium py-3 hover:bg-white/5 transition-colors">
                View all notifications →
              </Link>
            </div>
          )}
        </div>
        <Link href="/contact"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
        >
          <HelpCircle className="w-5 h-5" />
          Help & Support
        </Link>
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
        >
          {theme === "night"
            ? <Sun className="w-5 h-5 text-amber-400" />
            : <Moon className="w-5 h-5 text-slate-400" />}
          {theme === "night" ? "Day mode" : "Night mode"}
        </button>
        <LanguageSelector />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          {t("nav_sign_out")}
        </button>
      </div>
    </nav>
  );
}
