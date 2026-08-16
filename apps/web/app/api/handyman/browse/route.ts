import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Trades that legally require a license — "Licensed" badge only shows for these.
const LICENSE_REQUIRED = new Set(["PLUMBING", "ELECTRICAL", "HVAC", "ROOFING", "GENERAL"]);

// How far a customer will consider travelling to be served. Sixty miles, in km
// because haversine works in km.
const BROWSE_RADIUS_KM = 60 * 1.60934;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Queries the DB — must run at request time, not be prerendered at build time
// (build-time prerender can't load the Prisma engine / libssl in the Alpine image).
export const dynamic = "force-dynamic";

// Returns available handymen for the customer browse screen. Shape matches what
// the mobile/web browse expects: a flat user object with `handymanProfile` and
// a top-level `services` array, and `id` = the USER id (the detail screen calls
// /users/[id] with it).
export async function GET(req: NextRequest) {
  // The customer's position, when the app could get it. Absent is normal:
  // permission may be refused, and browsing must still work.
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const here =
    Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
      ? { lat, lng }
      : null;
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
    // Null when either side has no coordinates. That is not the same as far
    // away, and must not be treated as such — see the filter below.
    const distanceKm =
      here && h.latitude != null && h.longitude != null
        ? haversine(here.lat, here.lng, h.latitude, h.longitude)
        : null;
    return {
      distanceKm,
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

  // Nearest first, within 60 miles — but only for pros whose distance we
  // actually know.
  //
  // A pro with no coordinates is excluded from NOTHING here. Not one pro in the
  // database has coordinates today (they are captured when a pro goes online,
  // which only shipped in 1.0.12), so filtering on unknown distance would empty
  // this screen for every customer. Missing data is a gap in our records, not
  // evidence the pro is far away — the same rule the job fan-out follows.
  //
  // Premium placement is preserved as the first sort key: it is a paid position
  // and quietly demoting it to "whoever is closest" would change what those
  // pros bought. Distance orders within that.
  const located = here
    ? result.filter((r) => r.distanceKm === null || r.distanceKm <= BROWSE_RADIUS_KM)
    : result;

  if (here) {
    located.sort((a, b) => {
      const premium = Number(b.handymanProfile?.isPremium ?? false) - Number(a.handymanProfile?.isPremium ?? false);
      if (premium !== 0) return premium;
      // Unknown distance sorts after everything known, rather than to the top.
      const ad = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bd = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return (b.handymanProfile?.rating ?? 0) - (a.handymanProfile?.rating ?? 0);
    });
  }

  return NextResponse.json(located);
}
