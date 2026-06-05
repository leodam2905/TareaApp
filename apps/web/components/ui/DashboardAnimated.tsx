"use client";

import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  CalendarCheck, Star, Clock, DollarSign, ArrowRight, Wrench,
  Heart, Zap, Gift, Search, Plus, Bell,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

/* ─────────── Types ─────────── */

type Booking = {
  id: string;
  status: string;
  totalPrice: number;
  scheduledAt: Date;
  service: { title: string; category: string };
  handyman: { name: string; avatarUrl: string | null };
};

type Service = {
  id: string;
  title: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  handyman: { user: { name: string } } | null;
};

type UpcomingBooking = {
  id: string;
  scheduledAt: Date;
  status: string;
  service: { title: string; category: string };
  handyman: { name: string; avatarUrl: string | null };
} | null;

type Props = {
  user: { name: string };
  bookings: Booking[];
  recentServices: Service[];
  totalSpent: number;
  activeJobs: number;
  upcomingBooking: UpcomingBooking;
  favoritesCount: number;
  hasLocation: boolean;
};

/* ─────────── Variants ─────────── */

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "badge-yellow",
  ACCEPTED: "badge-sky",
  IN_PROGRESS: "badge-sky",
  COMPLETED: "badge-green",
  CANCELLED: "badge-red",
  DISPUTED: "badge-red",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

/* ─────────── 3D tilt card ─────────── */

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 });
  const glowX = useTransform(x, [-0.5, 0.5], ["0%", "100%"]);
  const glowY = useTransform(y, [-0.5, 0.5], ["0%", "100%"]);
  const [hovered, setHovered] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
    setHovered(false);
  }

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
    >
      {/* moving shine */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl pointer-events-none z-10 overflow-hidden"
            style={{
              background: `radial-gradient(circle at ${glowX} ${glowY}, rgba(56,189,248,0.12) 0%, transparent 60%)`,
            } as React.CSSProperties}
          />
        )}
      </AnimatePresence>
      <div style={{ transform: "translateZ(8px)" }}>{children}</div>
    </motion.div>
  );
}

/* ─────────── Floating orb (decorative) ─────────── */

function FloatingOrb({
  color, size, top, left, delay,
}: {
  color: string; size: number; top: string; left: string; delay: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, top, left, background: color, filter: "blur(60px)", opacity: 0.18 }}
      animate={{ y: [0, -20, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

/* ─────────── SVG grid decoration ─────────── */

function GridDots() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

/* ─────────── Main component ─────────── */

function LocationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [requested, setRequested] = useState(false);

  if (dismissed) return null;

  const request = () => {
    setRequested(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("/api/auth/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        }).catch(() => {});
        setDismissed(true);
      },
      () => setDismissed(true)
    );
  };

  return (
    <motion.div variants={fadeUp} className="flex items-center justify-between gap-4 px-5 py-4 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl">
      <div className="flex items-center gap-3">
        <span className="text-xl">📍</span>
        <div>
          <p className="text-white font-semibold text-sm">Enable location for nearby results</p>
          <p className="text-slate-400 text-xs">We'll show you handymen and jobs within 50 miles of you.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={request}
          disabled={requested}
          className="px-4 py-2 bg-tarea-sky text-tarea-ink text-sm font-bold rounded-xl hover:bg-sky-300 transition-all disabled:opacity-60"
        >
          {requested ? "Requesting…" : "Allow"}
        </button>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 text-xs px-2">
          Not now
        </button>
      </div>
    </motion.div>
  );
}

export default function DashboardAnimated({
  user, bookings, recentServices, totalSpent, activeJobs, upcomingBooking, hasLocation,
}: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  const completedCount = bookings.filter((b) => b.status === "COMPLETED").length;

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="space-y-6 max-w-7xl">

      {!hasLocation && <LocationBanner />}

      {/* ── Hero greeting (3D orbs + dot grid) ── */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-3xl border border-white/10 p-6 md:p-10"
        style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(139,92,246,0.08) 50%, transparent 100%)" }}
      >
        <GridDots />
        <FloatingOrb color="#38BDF8" size={300} top="-60px" left="60%" delay={0} />
        <FloatingOrb color="#8B5CF6" size={200} top="20px" left="80%" delay={2} />
        <FloatingOrb color="#F59E0B" size={150} top="40px" left="10%" delay={4} />

        {/* 3D floating card behind text */}
        <motion.div
          className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex"
          animate={{ y: [0, -10, 0], rotateZ: [0, 1, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ perspective: 600 }}
        >
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 w-52 shadow-2xl"
            style={{ transform: "perspective(600px) rotateY(-10deg) rotateX(5deg)" }}>
            <p className="text-slate-400 text-xs mb-2">Next booking</p>
            {upcomingBooking ? (
              <>
                <p className="text-white font-bold text-sm">{upcomingBooking.service.title}</p>
                <p className="text-tarea-sky text-xs mt-1">{formatDate(upcomingBooking.scheduledAt)}</p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">No upcoming bookings</p>
            )}
            <div className="mt-3 h-1 rounded-full bg-white/5">
              <div className="h-1 rounded-full bg-tarea-sky w-3/5" />
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 max-w-lg">
          <motion.p
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-slate-400 text-sm font-medium"
          >
            {greeting}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-5xl font-extrabold text-white mt-1 leading-tight"
          >
            {firstName} 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-slate-400 text-sm mt-3"
          >
            {activeJobs > 0
              ? `You have ${activeJobs} active job${activeJobs > 1 ? "s" : ""} in progress.`
              : "Ready for your next service?"}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.45 }}
            className="flex gap-3 flex-wrap mt-6"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/customer/browse"
                className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-semibold px-6 py-3 rounded-xl text-sm hover:bg-sky-300 transition-all shadow-lg shadow-tarea-sky/20"
              >
                <Wrench className="w-4 h-4" /> Find a Handyman
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/customer/post-job"
                className="flex items-center gap-2 bg-white/10 border border-white/15 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-white/15 transition-all"
              >
                <Plus className="w-4 h-4" /> Post a Job
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Upcoming booking alert ── */}
      <AnimatePresence>
        {upcomingBooking && (
          <motion.div
            key="upcoming"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link href={`/customer/bookings/${upcomingBooking.id}`}>
              <motion.div
                whileHover={{ scale: 1.01, y: -2 }}
                className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl hover:bg-amber-500/15 transition-all cursor-pointer"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0"
                >
                  <Bell className="w-5 h-5 text-amber-400" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">
                    Upcoming: {upcomingBooking.service.title}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    With {upcomingBooking.handyman.name} · {formatDate(upcomingBooking.scheduledAt)}
                  </p>
                </div>
                <span className={`${STATUS_COLOR[upcomingBooking.status] || "badge"} text-xs flex-shrink-0`}>
                  {STATUS_LABEL[upcomingBooking.status] || upcomingBooking.status}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
              </motion.div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats (3D tilt cards) ── */}
      <motion.div variants={container} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: bookings.length,            icon: CalendarCheck, color: "#38BDF8", bg: "rgba(56,189,248,0.12)",  glow: "rgba(56,189,248,0.25)"  },
          { label: "Active Jobs",    value: activeJobs,                 icon: Clock,         color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  glow: "rgba(245,158,11,0.25)"  },
          { label: "Completed",      value: completedCount,             icon: Star,          color: "#10B981", bg: "rgba(16,185,129,0.12)",  glow: "rgba(16,185,129,0.25)"  },
          { label: "Total Spent",    value: formatCurrency(totalSpent), icon: DollarSign,    color: "#A78BFA", bg: "rgba(167,139,250,0.12)", glow: "rgba(167,139,250,0.25)" },
        ].map(({ label, value, icon: Icon, color, bg, glow }, i) => (
          <motion.div key={label} variants={scaleIn} custom={i} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.2 }}>
            <TiltCard className="h-full">
              <div
                className="relative overflow-hidden bg-white/5 border border-white/[0.08] rounded-2xl p-5 h-full transition-shadow duration-300 hover:border-white/15"
                style={{ ["--glow" as string]: glow }}
              >
                {/* corner glow — brightens on hover */}
                <div
                  className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-80 pointer-events-none transition-opacity duration-300"
                  style={{ background: color }}
                />
                {/* bottom-left accent line */}
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-1/2 rounded-full opacity-50"
                  style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
                />
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: bg }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
                <p className="text-slate-500 text-xs font-medium mt-1">{label}</p>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div variants={fadeUp}>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <motion.div variants={container} className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Browse",    icon: Search,     href: "/customer/browse",    color: "#38BDF8", bg: "rgba(56,189,248,0.12)"  },
            { label: "Post Job",  icon: Plus,       href: "/customer/post-job",  color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
            { label: "Diagnose",  icon: Zap,        href: "/customer/diagnose",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
            { label: "Spending",  icon: DollarSign, href: "/customer/spending",  color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
            { label: "Favorites", icon: Heart,      href: "/customer/favorites", color: "#F472B6", bg: "rgba(244,114,182,0.12)" },
            { label: "Referrals", icon: Gift,       href: "/customer/referrals", color: "#FB923C", bg: "rgba(251,146,60,0.12)"  },
          ].map(({ label, icon: Icon, href, color, bg }) => (
            <motion.div
              key={label}
              variants={scaleIn}
              whileHover={{ scale: 1.08, y: -4 }}
              whileTap={{ scale: 0.94 }}
            >
              <Link
                href={href}
                className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/[0.08] rounded-2xl hover:bg-white/[0.09] hover:border-white/20 transition-all"
              >
                <motion.div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: bg }}
                  whileHover={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </motion.div>
                <span className="text-slate-300 text-xs font-medium">{label}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Bookings + Recommended ── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Recent bookings */}
        <motion.div
          variants={fadeUp}
          className="lg:col-span-3 bg-white/5 border border-white/[0.08] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
            <h2 className="text-sm font-bold text-white">Recent Bookings</h2>
            <Link
              href="/customer/bookings"
              className="flex items-center gap-1 text-tarea-sky text-xs font-medium hover:underline"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-10 px-6">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-5 w-44 h-44"
              >
                <img
                  src="/illustrations/empty-bookings.svg"
                  alt="No bookings"
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </motion.div>
              <p className="text-white font-semibold text-sm">No bookings yet</p>
              <p className="text-slate-500 text-xs mt-1 mb-5">Start by finding a handyman near you</p>
              <Link href="/customer/browse" className="btn-secondary text-xs px-4 py-2">
                Browse Services
              </Link>
            </div>
          ) : (
            <motion.div variants={container} className="divide-y divide-white/[0.05]">
              {bookings.map((b) => (
                <motion.div
                  key={b.id}
                  variants={fadeUp}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.025)" }}
                  transition={{ duration: 0.15 }}
                  className="relative group/row"
                >
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-tarea-sky scale-y-0 group-hover/row:scale-y-100 transition-transform origin-center duration-200" />
                  <Link
                    href={`/customer/bookings/${b.id}`}
                    className="flex items-center gap-3 px-6 py-3.5 transition-colors"
                  >
                    <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CategoryIcon catKey={b.service.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{b.service.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {b.handyman.name} · {formatDate(b.scheduledAt)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block mr-2">
                      <p className="text-white font-bold text-sm">{formatCurrency(b.totalPrice)}</p>
                    </div>
                    <span className={`${STATUS_COLOR[b.status] || "badge"} text-xs flex-shrink-0`}>
                      {STATUS_LABEL[b.status] || b.status.replace("_", " ")}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Recommended services */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Recommended</h2>
            <Link
              href="/customer/browse"
              className="flex items-center gap-1 text-tarea-sky text-xs font-medium hover:underline"
            >
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <motion.div variants={container} className="space-y-3">
            {recentServices.slice(0, 5).map((s) => (
              <motion.div
                key={s.id}
                variants={scaleIn}
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ duration: 0.18 }}
              >
                <Link
                  href={`/customer/browse?service=${s.id}`}
                  className="flex items-center gap-3 p-4 bg-white/5 border border-white/[0.08] rounded-xl hover:border-tarea-sky/30 hover:bg-white/[0.07] transition-all group"
                >
                  <div className="w-9 h-9 bg-tarea-sky/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CategoryIcon catKey={s.category} active />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-xs truncate">{s.title}</p>
                    <p className="text-tarea-sky text-xs font-bold mt-0.5">
                      {formatCurrency(s.minPrice)} – {formatCurrency(s.maxPrice)}
                    </p>
                  </div>
                  <motion.div
                    className="flex-shrink-0"
                    animate={{ x: 0 }}
                    whileHover={{ x: 3 }}
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-tarea-sky transition-colors" />
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

      </div>
    </motion.div>
  );
}
