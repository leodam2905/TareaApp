"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Users, Briefcase, Wrench, LogOut, AlertTriangle, DollarSign, Hammer, BarChart2, Tag, Settings, Zap, Sun, Moon, MapPin, Lock, Menu, X, ImageIcon } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useT } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";

export default function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/admin/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    { href: "/admin/users",     label: t("nav_users"),     icon: Users },
    { href: "/admin/bookings",  label: t("nav_bookings"),  icon: Briefcase },
    { href: "/admin/services",  label: t("nav_services"),  icon: Wrench },
    // Sits next to Bookings because it is the other half of the same funnel:
    // Bookings are jobs that found a pro, these are jobs still looking.
    { href: "/admin/job-requests", label: "Posted Jobs",     icon: ImageIcon },
    { href: "/admin/analytics", label: "Analytics",        icon: BarChart2 },
    { href: "/admin/disputes",  label: "Disputes",         icon: AlertTriangle },
    { href: "/admin/payouts",   label: "Payouts",          icon: DollarSign },
    { href: "/admin/handymen",  label: "Handymen",         icon: Hammer },
    { href: "/admin/promo-codes", label: "Promo Codes",    icon: Tag },
    { href: "/admin/states",     label: "State Coverage",  icon: MapPin },
    { href: "/admin/webhooks",   label: "Webhooks",        icon: Zap },
    { href: "/admin/settings",   label: "Settings",        icon: Settings },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t("toast_signed_out"));
    router.push("/");
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Logo size={28} light />
          <p className="text-red-400 text-xs font-semibold ml-1">Admin Panel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 font-bold text-sm">
            {userName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-semibold truncate max-w-[130px]">{userName}</p>
            <span className="text-xs text-red-400 font-medium">Administrator</span>
          </div>
        </div>
      </div>

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
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </motion.div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10 space-y-1">
        <Link href="/account/change-password">
          <motion.div
            whileHover={{ x: 4 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <Lock className="w-5 h-5 flex-shrink-0" />
            Change Password
          </motion.div>
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
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="h-screen w-64 bg-tarea-ink border-r border-white/10 hidden lg:flex flex-col fixed left-0 top-0 z-40">
        <SidebarContent />
      </nav>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-tarea-ink border-b border-white/10 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Logo size={24} light />
          <span className="text-red-400 text-xs font-semibold">Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white p-1">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 z-50"
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-tarea-ink flex flex-col z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Logo size={24} light />
                  <span className="text-red-400 text-xs font-semibold">Admin</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent />
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
