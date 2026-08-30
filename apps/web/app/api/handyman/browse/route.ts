import { NextRequest, NextResponse } from "next/server";
import { matchScore, matchQuality, credentialTier } from "@/lib/matching";
import { prisma } from "@/lib/prisma";
import { BOOKABLE_USER_WHERE } from "@/lib/pro-bookable";
import { milesFromKmOrNull } from "@/lib/units";
import { credentialBadges, CREDENTIAL_SELECT, LICENSE_REQUIRED } from "@/lib/credentials";

// Trades that legally require a license — "Licensed" badge only shows for these.
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
      // Bookable means bookable: all six onboarding steps complete.
      //
      // Listing a pro who cannot be hired sets the customer up to pick somebody
      // and be told no at the last step, with the pro looking like the problem.
      // The condition lives in one place so browse, applying and hiring cannot
      // drift apart.
      ...BOOKABLE_USER_WHERE,
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
          // The full credential set, so the badges can mean approved + unexpired
          // rather than "a file was uploaded". See lib/credentials.ts.
          ...CREDENTIAL_SELECT,
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
      // Shown to people; distanceKm is kept for older app builds.
      distanceMiles: milesFromKmOrNull(distanceKm),
      id: h.id,
      name: h.name,
      avatarUrl: h.avatarUrl,
      city: h.city,
      state: h.state,
      // Coordinates are NOT returned.
      //
      // They are selected above only to compute distanceKm here, on the
      // server. Passing them on handed every signed-in customer a pro's home
      // location at full precision — pros register their home address, the app
      // never read these fields, and the UI only ever shows the distance. A
      // number nobody uses is not worth a privacy exposure.
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
        // Approved by an admin AND unexpired — a badge shown to a customer must
        // not be lit by the mere existence of an uploaded file.
        licensed: (hp ? credentialBadges(hp).licensed : false)
          && (hp?.services ?? []).some(sv => LICENSE_REQUIRED.has(sv.category)),
        insured: hp ? credentialBadges(hp).insured : false,
        paymentVerified: h.stripeAccountStatus === "active",
        topRated: rating >= 4.8 && jobs >= 10,
        topPro: !!hp?.isPremium,
      },
      // Why this pro sits where they do, as codes the apps localise. Same
      // scorer as /api/match, so Browse and matching cannot disagree.
      match: matchQuality({
        rating, totalJobs: jobs, responseTime: 60,
        isPremium: !!hp?.isPremium, distanceKm,
        licensed: hp ? credentialBadges(hp).licensed : false,
        insured: hp ? credentialBadges(hp).insured : false,
      }),
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
  // Never return an empty list because of the radius.
  //
  // The radius is a preference, not a rule. With supply still thin a customer
  // in a city with no pros yet gets an empty screen, which reads as a broken
  // app rather than "nobody here yet" — and they are a customer who was
  // expensive to acquire and will not come back to check. So when the filter
  // would return nothing, fall back to everyone, ranked, and let the distance
  // shown on each card tell the truth.
  const withinRadius = here
    ? result.filter((r) => r.distanceKm === null || r.distanceKm <= BROWSE_RADIUS_KM)
    : result;
  const located = withinRadius.length > 0 ? withinRadius : result;
  const outsideRadius = withinRadius.length === 0 && result.length > 0;

  // Ranked by fit, using the same scorer as /api/match — one definition of
  // "best pro", so Browse and matching cannot show different orders for the
  // same people.
  //
  // Paid placement used to be the FIRST sort key, ahead of rating entirely: a
  // premium pro with two stars sat above an unpromoted one with five. It is now
  // a bounded boost inside the score, so it lifts a pro without letting them
  // outrank being good — which is what keeps the list worth reading.
  located.sort((a, b) => {
    const rankable = (r: (typeof located)[number]) => ({
      rating: r.handymanProfile?.rating ?? 0,
      totalJobs: r.handymanProfile?.totalJobs ?? 0,
      responseTime: 60,
      isPremium: r.handymanProfile?.isPremium ?? false,
      distanceKm: r.distanceKm,
      licensed: !!r.match?.licensed,
      insured: !!r.match?.insured,
    });
    // Licensed and insured first, then fit. A credential is a tier rather than
    // a boost: no amount of good reviews should lift an uninsured pro above an
    // insured one, because the exposure it covers is the customer's either way.
    // Browse spans categories, so a licence is relevant to a pro when ANY of
    // the trades they list is one the law regulates — the same rule that
    // decides whether their Licensed badge lights up.
    const relevant = (r: (typeof located)[number]) =>
      (r.services ?? []).some((sv) => LICENSE_REQUIRED.has(sv.category));
    const tier =
      credentialTier(rankable(b), relevant(b)) - credentialTier(rankable(a), relevant(a));
    return tier !== 0 ? tier : matchScore(rankable(b)) - matchScore(rankable(a));
  });

  // Flagged so the client can say "nearest available" rather than implying
  // these pros are close by.
  return NextResponse.json(
    outsideRadius ? { handymen: located, outsideRadius: true } : located,
  );
}
