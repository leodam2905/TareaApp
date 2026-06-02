"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle2, Lock, ChevronRight, ListChecks } from "lucide-react";

export default async function SetupChecklistPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let profile = user.handymanProfile;
  if (!profile) {
    profile = await prisma.handymanProfile.create({
      data: { userId: user.id, hourlyRate: 50 },
    });
  }

  const [ownServicesCount, availabilityCount] = await Promise.all([
    prisma.service.count({ where: { handymanId: profile.id } }),
    prisma.handymanAvailability.count({ where: { profileId: profile.id } }),
  ]);

  const BG_INITIATED = ["PAID", "IN_PROGRESS", "DEFERRED", "PASSED"];

  const steps = [
    {
      key: "ica",
      label: "Sign Contractor Agreement",
      desc: "Read and e-sign the Independent Contractor Agreement. Required before accessing the platform.",
      href: "/handyman/onboarding",
      done: !!profile.icaSignedAt,
      requires: null as string | null,
    },
    {
      key: "profile",
      label: "Complete Your Profile",
      desc: "Add a profile photo, write a bio, and upload the front and back of your government ID.",
      href: "/handyman/profile",
      done: !!(user.avatarUrl && profile.bio && profile.idFrontUrl),
      requires: "ica",
    },
    {
      key: "services",
      label: "Add Your Services",
      desc: "Select the services you offer, set pricing, and describe your work so customers can find you.",
      href: "/handyman/onboarding",
      done: ownServicesCount > 0,
      requires: "profile",
    },
    {
      key: "availability",
      label: "Set Your Availability",
      desc: "Choose which days and hours you're open to taking bookings each week.",
      href: "/handyman/schedule",
      done: availabilityCount > 0,
      requires: "services",
    },
    {
      key: "backgroundCheck",
      label: "Complete Background Check",
      desc: "A one-time $29.99 background check is required before you can receive job requests from customers.",
      href: "/handyman/onboarding",
      done: BG_INITIATED.includes(profile.backgroundCheckStatus as string),
      requires: "availability",
    },
    {
      key: "stripe",
      label: "Connect Stripe to Get Paid",
      desc: "Link your bank account via Stripe Connect to receive payouts for completed jobs within 30 minutes.",
      href: "/handyman/payout-methods",
      done: user.stripeAccountStatus === "active",
      requires: "backgroundCheck",
    },
  ];

  const doneMap: Record<string, boolean> = Object.fromEntries(steps.map(s => [s.key, s.done]));
  const completedCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-tarea-sky/15 border border-tarea-sky/30 rounded-2xl flex items-center justify-center">
          <ListChecks className="w-6 h-6 text-tarea-sky" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Setup Checklist</h1>
          <p className="text-slate-400 text-sm mt-0.5">Complete all steps to start receiving bookings</p>
        </div>
      </div>

      {/* Progress card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-300 text-sm font-medium">
            {allDone ? "All steps complete — you're live!" : `${completedCount} of ${totalCount} steps complete`}
          </p>
          <span className="text-2xl font-black text-white">
            {completedCount}<span className="text-slate-500 text-lg font-normal">/{totalCount}</span>
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: allDone ? "#10B981" : "linear-gradient(90deg, #38BDF8, #0EA5E9)",
            }}
          />
        </div>
        {allDone && (
          <p className="text-emerald-400 text-sm font-semibold mt-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Your profile is fully set up. Customers can now book you!
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const locked = step.requires !== null && !doneMap[step.requires];
          return (
            <div
              key={step.key}
              className={`flex items-start gap-4 p-5 rounded-2xl border transition-all ${
                step.done
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : locked
                  ? "bg-white/2 border-white/5 opacity-40"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {/* Circle */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold ${
                step.done
                  ? "bg-emerald-500 text-white"
                  : locked
                  ? "bg-white/5 border border-white/15 text-slate-600"
                  : "bg-tarea-sky/15 border border-tarea-sky/40 text-tarea-sky"
              }`}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : locked ? <Lock className="w-3.5 h-3.5" /> : index + 1}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${step.done ? "text-slate-400 line-through" : locked ? "text-slate-600" : "text-white"}`}>
                  {step.label}
                </p>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">{step.desc}</p>
              </div>

              {/* Action */}
              <div className="flex-shrink-0 mt-0.5">
                {step.done ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                ) : locked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                ) : (
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-bold text-tarea-sky bg-tarea-sky/10 hover:bg-tarea-sky/20 px-3 py-1.5 rounded-full border border-tarea-sky/30 transition-colors"
                  >
                    Start <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-slate-600 text-xs text-center">
        Steps unlock in order as you complete each one · Refresh this page after completing a step to update its status
      </p>
    </div>
  );
}
