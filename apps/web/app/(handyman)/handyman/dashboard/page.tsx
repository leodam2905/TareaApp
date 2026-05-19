import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Briefcase, DollarSign, Star, Clock, ShieldCheck, ShieldAlert, ShieldOff, Camera } from "lucide-react";
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

  const [bookings, services] = await Promise.all([
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
  ]);

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const activeCount = bookings.filter((b) => ["ACCEPTED", "IN_PROGRESS"].includes(b.status)).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            Welcome, {user.name.split(" ")[0]} 🔧
          </h1>
          <p className="text-slate-400 mt-1">Manage your jobs and earnings from here.</p>
        </div>
        <div className="flex items-center gap-3">
          <AvailabilityToggle initial={profile.isAvailable} />
          <Link href="/handyman/onboarding" className="btn-secondary">✏️ Edit Services</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "Total Earnings", value: formatCurrency(profile.totalEarnings), icon: DollarSign, color: "text-emerald-400" },
          { label: "Total Jobs", value: profile.totalJobs, icon: Briefcase, color: "text-tarea-sky" },
          { label: "Rating", value: `${profile.rating.toFixed(1)} ★`, icon: Star, color: "text-amber-400" },
          { label: "Pending Requests", value: pendingCount, icon: Clock, color: "text-orange-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-sm font-medium">{label}</p>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Profile photo banner */}
      {!user.avatarUrl && (
        <div className="flex items-start gap-4 p-5 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
          <Camera className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-orange-300 font-semibold">Profile photo required</p>
            <p className="text-orange-400/70 text-sm mt-0.5">You won't appear in customer searches or be able to apply to jobs until you add a profile photo.</p>
          </div>
          <Link href="/handyman/profile" className="text-orange-300 text-sm font-semibold hover:underline whitespace-nowrap">Add photo →</Link>
        </div>
      )}

      {/* Background check banner */}
      {profile.backgroundCheckStatus === "PENDING" && (
        <div className="flex items-start gap-4 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-300 font-semibold">Background check required</p>
            <p className="text-amber-400/70 text-sm mt-0.5">A background check is required to receive job requests. Complete it now from your onboarding page.</p>
          </div>
          <Link href="/handyman/onboarding" className="text-amber-300 text-sm font-semibold hover:underline whitespace-nowrap">Start →</Link>
        </div>
      )}
      {profile.backgroundCheckStatus === "DEFERRED" && (
        <div className="flex items-start gap-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <ShieldCheck className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-blue-300 font-semibold">Background check — fee deferred</p>
            <p className="text-blue-400/70 text-sm mt-0.5">The $29.99 fee will be deducted from your first payout.</p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "IN_PROGRESS" && (
        <div className="flex items-start gap-4 p-5 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl">
          <ShieldCheck className="w-6 h-6 text-tarea-sky flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-tarea-sky font-semibold">Background check in progress</p>
            <p className="text-slate-400 text-sm mt-0.5">We'll notify you once the results are ready (usually 1–3 business days).</p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "FAILED" && (
        <div className="flex items-start gap-4 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl">
          <ShieldOff className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold">Background check flagged</p>
            <p className="text-red-400/70 text-sm mt-0.5">Your background check came back with issues. Please contact support for next steps.</p>
          </div>
        </div>
      )}
      {profile.backgroundCheckStatus === "PASSED" && (
        <div className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-emerald-300 font-semibold">Background check passed ✓</p>
            <p className="text-emerald-400/70 text-sm">Your verified badge is now visible to customers.</p>
          </div>
        </div>
      )}

      {/* Active jobs */}
      {activeCount > 0 && (
        <div className="bg-tarea-sky/10 border border-tarea-sky/30 rounded-2xl p-5">
          <p className="text-tarea-sky font-semibold">
            🔵 You have {activeCount} active job{activeCount > 1 ? "s" : ""} in progress.{" "}
            <Link href="/handyman/jobs" className="underline">Manage them →</Link>
          </p>
        </div>
      )}

      {/* Job timers */}
      <JobTimerSection bookings={bookings.map(b => ({
        id: b.id,
        status: b.status,
        service: { title: b.service.title, duration: b.service.duration },
        customer: { name: b.customer.name },
      }))} />

      {/* Recent bookings */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Recent Job Requests</h2>
          <Link href="/handyman/jobs" className="text-tarea-sky text-sm font-medium hover:underline">
            View all →
          </Link>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-400">No bookings yet. Add services to start receiving jobs.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-tarea-sky/20 transition-colors">
                <div className="w-10 h-10 bg-tarea-dark/60 rounded-xl flex items-center justify-center text-xl">
                  {SERVICE_CATEGORY_ICONS[b.service.category] || "🛠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{b.service.title}</p>
                  <p className="text-slate-400 text-sm">{b.customer.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold">{formatCurrency(b.totalPrice)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(b.scheduledAt)}</p>
                </div>
                <span className={statusColor[b.status] || "badge"}>{b.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Services */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">My Services ({services.length})</h2>
          <Link href="/handyman/jobs/new" className="text-tarea-sky text-sm font-medium hover:underline">
            + Add new →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {services.map((s) => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-tarea-sky/30 transition-colors">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-2xl">{SERVICE_CATEGORY_ICONS[s.category] || "🛠️"}</span>
                <span className={s.isActive ? "badge-green" : "badge-red"}>
                  {s.isActive ? "Active" : "Paused"}
                </span>
                {!s.handymanId && (
                  <span className="badge-sky text-xs">📢 Platform</span>
                )}
              </div>
              <p className="text-white font-semibold">{s.title}</p>
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
