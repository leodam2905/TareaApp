import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Briefcase, DollarSign, Star, Clock,
  ShieldCheck, ShieldAlert, ShieldOff, Camera,
  CheckCircle2, Lock, ChevronRight, ArrowRight,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, SERVICE_CATEGORY_ICONS } from "@/lib/utils";
import JobTimerSection from "@/components/ui/JobTimer";
import AvailabilityToggle from "@/components/ui/AvailabilityToggle";

export default async function HandymanDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  let profile = user.handymanProfile;

  if (!profile) {
    profile = await prisma.handymanProfile.create({
      data: { userId: user.id, hourlyRate: 50 },
    });
  }

  const [bookings, services, availabilityCount] = await Promise.all([
    prisma.booking.findMany({
      where: { handymanId: user.id },
      include: {
        service: true,
        customer: { select: { name: true, avatarUrl: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.service.findMany({
      where: { OR: [{ handymanId: profile.id }, { handymanId: null }] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.handymanAvailability.count({ where: { profileId: profile.id } }),
  ]);

  const BG_INITIATED = ["PAID", "IN_PROGRESS", "DEFERRED", "PASSED"];
  const checklist = {
    ica:             !!profile.icaSignedAt,
    profile:         !!(user.avatarUrl && profile.bio && profile.idFrontUrl),
    services:        services.filter(s => s.handymanId === profile!.id).length > 0,
    availability:    availabilityCount > 0,
    backgroundCheck: BG_INITIATED.includes(profile.backgroundCheckStatus),
    stripe:          user.stripeAccountStatus === "active",
  };
  const completedSteps = Object.values(checklist).filter(Boolean).length;
  const totalSteps = Object.keys(checklist).length;
  const allDone = completedSteps === totalSteps;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const activeCount = bookings.filter((b) =>
    ["ACCEPTED", "IN_PROGRESS"].includes(b.status)
  ).length;

  const statusColor: Record<string, string> = {
    PENDING: "badge-yellow",
    ACCEPTED: "badge-sky",
    IN_PROGRESS: "badge-sky",
    COMPLETED: "badge-green",
    CANCELLED: "badge-red",
    DISPUTED: "badge-red",
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-white/5 to-tarea-sky/10 border border-white/10 rounded-2xl p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Handyman Dashboard</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              {user.name.split(" ")[0]} 🔧
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {activeCount > 0
                ? `${activeCount} active job${activeCount > 1 ? "s" : ""} in progress`
                : "Manage your jobs and earnings from here."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <AvailabilityToggle initial={profile.isAvailable} />
            <Link
              href="/handyman/onboarding"
              className="flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-white/15 transition-all text-sm border border-white/10"
            >
              ✏️ Edit Services
            </Link>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Earnings",
            value: formatCurrency(profile.totalEarnings),
            icon: DollarSign,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
          },
          {
            label: "Total Jobs",
            value: profile.totalJobs,
            icon: Briefcase,
            iconBg: "bg-sky-500/15",
            iconColor: "text-tarea-sky",
          },
          {
            label: "Rating",
            value: `${profile.rating.toFixed(1)} ★`,
            icon: Star,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-400",
          },
          {
            label: "Pending Requests",
            value: pendingCount,
            icon: Clock,
            iconBg: "bg-orange-500/15",
            iconColor: "text-orange-400",
          },
        ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div
            key={label}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors"
          >
            <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
            </div>
            <p className={`text-2xl font-bold ${iconColor}`}>{value}</p>
            <p className="text-slate-400 text-xs font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Banners */}
      {!user.avatarUrl && (
        <div className="flex items-start gap-4 p-5 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
          <Camera className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-orange-300 font-semibold text-sm">Profile photo required</p>
            <p className="text-orange-400/70 text-xs mt-0.5">
              You won't appear in customer searches until you add a profile photo.
            </p>
          </div>
          <Link href="/handyman/profile" className="text-orange-300 text-sm font-semibold hover:underline whitespace-nowrap">
            Add photo →
          </Link>
        </div>
      )}
      {profile.backgroundCheckStatus === "PENDING" && (
        <div className="flex items-start gap-4 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm">Background check required</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Required to receive job requests. Complete it from your onboarding page.
            </p>
          </div>
          <Link href="/handyman/onboarding" className="text-amber-300 text-sm font-semibold hover:underline whitespace-nowrap">
            Start →
          </Link>
        </div>
      )}
      {profile.backgroundCheckStatus === "DEFERRED" && (
        <div className="flex items-start gap-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 font-semibold text-sm">Background check — fee deferred</p>
            <p className="text-blue-400/70 text-xs mt-0.5">The $29.99 fee will be deducted from your first payout.</p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "IN_PROGRESS" && (
        <div className="flex items-start gap-4 p-5 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl">
          <ShieldCheck className="w-5 h-5 text-tarea-sky flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-tarea-sky font-semibold text-sm">Background check in progress</p>
            <p className="text-slate-400 text-xs mt-0.5">
              We'll notify you once results are ready (usually 1–3 business days).
            </p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "FAILED" && (
        <div className="flex items-start gap-4 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl">
          <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Background check flagged</p>
            <p className="text-red-400/70 text-xs mt-0.5">Please contact support for next steps.</p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "PASSED" && (
        <div className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-emerald-300 font-semibold text-sm">Background check passed ✓</p>
            <p className="text-emerald-400/70 text-xs">Your verified badge is now visible to customers.</p>
          </div>
        </div>
      )}
      {activeCount > 0 && (
        <div className="flex items-center justify-between p-5 bg-tarea-sky/10 border border-tarea-sky/30 rounded-2xl">
          <p className="text-tarea-sky font-semibold text-sm">
            🔵 {activeCount} active job{activeCount > 1 ? "s" : ""} in progress
          </p>
          <Link href="/handyman/jobs" className="flex items-center gap-1 text-tarea-sky text-sm font-bold hover:underline">
            Manage <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Setup checklist */}
      {!allDone && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">Setup Checklist</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {completedSteps} of {totalSteps} steps complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-tarea-sky" />
              <span className="text-2xl font-black text-white">
                {progressPct}
                <span className="text-slate-500 text-sm font-normal">%</span>
              </span>
            </div>
          </div>

          <div className="w-full bg-white/10 rounded-full h-1.5 mb-6 mt-4">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #38BDF8, #818CF8)",
              }}
            />
          </div>

          <div className="space-y-2">
            {(
              [
                { key: "ica",             label: "Sign Contractor Agreement",  desc: "Read and e-sign the ICA.",                                    href: "/handyman/onboarding",    requires: null },
                { key: "profile",         label: "Complete Your Profile",       desc: "Add photo, bio, and government ID.",                          href: "/handyman/profile",       requires: "ica" },
                { key: "services",        label: "Add Your Services",           desc: "Set your services, pricing, and duration.",                   href: "/handyman/services",      requires: "profile" },
                { key: "availability",    label: "Set Your Availability",       desc: "Choose days and hours open to bookings.",                     href: "/handyman/schedule",      requires: "services" },
                { key: "backgroundCheck", label: "Background Check",            desc: "One-time $29.99 — required to receive bookings.",             href: "/handyman/onboarding",    requires: "availability" },
                { key: "stripe",          label: "Connect Stripe to Get Paid",  desc: "Link your bank to receive payouts.",                          href: "/handyman/payout-methods", requires: "backgroundCheck" },
              ] as { key: keyof typeof checklist; label: string; desc: string; href: string; requires: keyof typeof checklist | null }[]
            ).map(({ key, label, desc, href, requires }, index) => {
              const done = checklist[key];
              const locked = requires !== null && !checklist[requires];
              return (
                <div
                  key={key}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                    done
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : locked
                      ? "border-white/5 opacity-40"
                      : "bg-white/5 border-white/10 hover:border-tarea-sky/30"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      done
                        ? "bg-emerald-500 text-white"
                        : locked
                        ? "bg-white/5 text-slate-600 border border-white/10"
                        : "bg-tarea-sky/15 text-tarea-sky border border-tarea-sky/30"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : locked ? <Lock className="w-3 h-3" /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold text-sm ${
                        done ? "text-slate-500 line-through" : locked ? "text-slate-600" : "text-white"
                      }`}
                    >
                      {label}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{desc}</p>
                  </div>

                  {done ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full flex-shrink-0">
                      Done
                    </span>
                  ) : locked ? (
                    <span className="text-xs font-bold text-slate-600 bg-white/5 px-2.5 py-1 rounded-full flex-shrink-0">
                      Locked
                    </span>
                  ) : (
                    <Link
                      href={href}
                      className="text-xs font-bold text-tarea-sky bg-tarea-sky/10 hover:bg-tarea-sky/20 px-3 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1 transition-colors"
                    >
                      Start <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Job timers */}
      <JobTimerSection
        bookings={bookings.map((b) => ({
          id: b.id,
          status: b.status,
          service: { title: b.service.title, duration: b.service.duration },
          customer: { name: b.customer.name },
        }))}
      />

      {/* Recent bookings */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Recent Job Requests</h2>
          <Link
            href="/handyman/jobs"
            className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
              📋
            </div>
            <p className="text-slate-400 font-medium">No bookings yet</p>
            <p className="text-slate-500 text-sm mt-1">Add services to start receiving job requests</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {bookings.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-10 h-10 bg-tarea-dark/60 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {SERVICE_CATEGORY_ICONS[b.service.category] || "🛠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{b.service.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{b.customer.name}</p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-white font-bold text-sm">{formatCurrency(b.totalPrice)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(b.scheduledAt)}</p>
                </div>
                <span className={statusColor[b.status] || "badge"}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Services */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">
            My Services
            <span className="text-slate-500 font-normal ml-2">({services.length})</span>
          </h2>
          <Link
            href="/handyman/jobs/new"
            className="flex items-center gap-1 text-tarea-sky text-sm font-medium hover:underline"
          >
            + Add new <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-tarea-sky/30 hover:bg-white/[0.07] transition-all"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-2xl">{SERVICE_CATEGORY_ICONS[s.category] || "🛠️"}</span>
                <span className={s.isActive ? "badge-green" : "badge-red"}>
                  {s.isActive ? "Active" : "Paused"}
                </span>
                {!s.handymanId && (
                  <span className="badge-sky text-xs">📢 Platform</span>
                )}
              </div>
              <p className="text-white font-semibold text-sm">{s.title}</p>
              <p className="text-tarea-sky text-sm font-bold mt-1">
                {formatCurrency(s.minPrice)}–{formatCurrency(s.maxPrice)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
