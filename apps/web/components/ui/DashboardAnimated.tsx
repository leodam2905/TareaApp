"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CalendarCheck, Star, Clock, DollarSign, ArrowRight, Wrench, ScanSearch } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

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

type Props = {
  user: { name: string };
  bookings: Booking[];
  recentServices: Service[];
  totalSpent: number;
  activeJobs: number;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const statusColor: Record<string, string> = {
  PENDING: "badge-yellow",
  ACCEPTED: "badge-sky",
  IN_PROGRESS: "badge-sky",
  COMPLETED: "badge-green",
  CANCELLED: "badge-red",
  DISPUTED: "badge-red",
};

export default function DashboardAnimated({ user, bookings, recentServices, totalSpent, activeJobs }: Props) {
  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-8">

      {/* Hero */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden bg-gradient-to-br from-tarea-sky/15 via-white/5 to-violet-500/10 border border-white/10 rounded-2xl p-6 md:p-8"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Welcome back</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              {user.name.split(" ")[0]} 👋
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {activeJobs > 0
                ? `You have ${activeJobs} active job${activeJobs > 1 ? "s" : ""} in progress.`
                : "Ready to book your next service?"}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/customer/browse"
                className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-semibold px-5 py-2.5 rounded-xl hover:bg-sky-300 transition-all text-sm"
              >
                <Wrench className="w-4 h-4" /> Find a Handyman
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/customer/diagnose"
                className="flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/15 transition-all text-sm border border-white/10"
              >
                <ScanSearch className="w-4 h-4" /> Diagnose Issue
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/customer/bookings"
                className="flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/15 transition-all text-sm border border-white/10"
              >
                My Bookings
              </Link>
            </motion.div>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-tarea-sky/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* Stats */}
      <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: bookings.length, icon: CalendarCheck, iconBg: "bg-sky-500/15", iconColor: "text-tarea-sky" },
          { label: "Active Jobs",    value: activeJobs,      icon: Clock,         iconBg: "bg-amber-500/15", iconColor: "text-amber-400" },
          { label: "Completed",      value: bookings.filter(b => b.status === "COMPLETED").length, icon: Star, iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400" },
          { label: "Total Spent",    value: formatCurrency(totalSpent), icon: DollarSign, iconBg: "bg-violet-500/15", iconColor: "text-violet-400" },
        ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <motion.div
            key={label}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors cursor-default"
          >
            <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
            </div>
            <p className={`text-2xl font-bold ${iconColor}`}>{value}</p>
            <p className="text-slate-400 text-xs font-medium mt-1">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Bookings */}
      <motion.div variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Recent Bookings</h2>
          <Link href="/customer/bookings" className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">📋</div>
            <p className="text-slate-400 font-medium">No bookings yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">Start by finding a handyman near you</p>
            <Link href="/customer/browse" className="btn-secondary text-sm px-5 py-2.5">Browse Services</Link>
          </div>
        ) : (
          <motion.div variants={stagger} className="divide-y divide-white/5">
            {bookings.map(b => (
              <motion.div
                key={b.id}
                variants={fadeUp}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CategoryIcon catKey={b.service.category} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{b.service.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">With {b.handyman.name}</p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-white font-bold text-sm">{formatCurrency(b.totalPrice)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(b.scheduledAt)}</p>
                </div>
                <span className={statusColor[b.status] || "badge"}>{b.status.replace("_", " ")}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Recommended Services */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Recommended Services</h2>
          <Link href="/customer/browse" className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline">
            See all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <motion.div variants={stagger} className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recentServices.map(s => (
            <motion.div
              key={s.id}
              variants={fadeUp}
              whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}
            >
              <Link href={`/customer/browse?service=${s.id}`}>
                <div className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-tarea-sky/40 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-tarea-sky/10 rounded-xl flex items-center justify-center">
                      <CategoryIcon catKey={s.category} active />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{s.title}</p>
                      <p className="text-slate-400 text-xs truncate">{s.handyman?.user.name ?? "Platform Service"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-tarea-sky font-bold text-sm">{formatCurrency(s.minPrice)} – {formatCurrency(s.maxPrice)}</p>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-tarea-sky transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

    </motion.div>
  );
}
