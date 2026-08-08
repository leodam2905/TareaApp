import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Trades that legally require a license — "Licensed" badge only shows for these.
const LICENSE_REQUIRED = new Set(["PLUMBING", "ELECTRICAL", "HVAC", "ROOFING", "GENERAL"]);

// Queries the DB — must run at request time, not be prerendered at build time
// (build-time prerender can't load the Prisma engine / libssl in the Alpine image).
export const dynamic = "force-dynamic";

// Returns available handymen for the customer browse screen. Shape matches what
// the mobile/web browse expects: a flat user object with `handymanProfile` and
// a top-level `services` array, and `id` = the USER id (the detail screen calls
// /users/[id] with it).
export async function GET(_req: NextRequest) {
  const handymen = await prisma.user.findMany({
    where: {
      role: "HANDYMAN",
      isActive: true,
      handymanProfile: { isAvailable: true },
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      isVerified: true,
      // Server-side only — never returned; drives the phoneVerified trust badge.
      phone: true,
      stripeAccountStatus: true,
      handymanProfile: {
        select: {
          bio: true,
          hourlyRate: true,
          rating: true,
          totalJobs: true,
          isPremium: true,
          yearsExperience: true,
          backgroundCheckStatus: true,
          licenseDocUrl: true,
          insuranceDocUrl: true,
          services: {
            where: { isActive: true },
            select: { title: true, category: true },
          },
        },
      },
    },
    orderBy: [
      { handymanProfile: { isPremium: "desc" } },
      { handymanProfile: { rating: "desc" } },
    ],
  });

  const result = handymen.map((h) => {
    const hp = h.handymanProfile;
    const rating = hp?.rating ?? 0;
    const jobs = hp?.totalJobs ?? 0;
    return {
      id: h.id,
      name: h.name,
      avatarUrl: h.avatarUrl,
      city: h.city,
      state: h.state,
      latitude: h.latitude,
      longitude: h.longitude,
      isVerified: h.isVerified,
      handymanProfile: hp
        ? {
            bio: hp.bio,
            hourlyRate: hp.hourlyRate,
            rating: hp.rating,
            totalJobs: hp.totalJobs,
            isPremium: hp.isPremium,
            yearsExperience: hp.yearsExperience,
          }
        : null,
      services: hp?.services ?? [],
      // Trust signals — the client shows only the top few that apply.
      trust: {
        identityVerified: h.isVerified,
        phoneVerified: !!h.phone,
        backgroundChecked: hp?.backgroundCheckStatus === "PASSED",
        licensed: !!hp?.licenseDocUrl && (hp?.services ?? []).some(sv => LICENSE_REQUIRED.has(sv.category)),
        insured: !!hp?.insuranceDocUrl,
        paymentVerified: h.stripeAccountStatus === "active",
        topRated: rating >= 4.8 && jobs >= 10,
        topPro: !!hp?.isPremium,
      },
    };
  });

  return NextResponse.json(result);
}
