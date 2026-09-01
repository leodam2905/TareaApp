import { NextRequest, NextResponse } from "next/server";
import { stateAliases } from "@/lib/us-states";
import { matchScore, matchQuality, credentialTier, isAvailableAt } from "@/lib/matching";
// findMany uses `include`, which returns every scalar on the profile, so the
// credential columns credentialBadges reads are already present.
import { credentialBadges, licenseMatters, licenseAlwaysRequired } from "@/lib/credentials";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const RADIUS_KM = 50 * 1.60934; // 50 miles in km

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
  // When the customer has picked a time, only show pros who work then —
  // matching on availability is the whole point of the flow.
  const whenParam = searchParams.get("when");
  const when = whenParam ? new Date(whenParam) : null;
    const category = searchParams.get("category");

    if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });

    let user = null;
    try { user = await getCurrentUser(); } catch { /* unauthenticated */ }

    // Restrict to active states (if any are configured)
    const activeStates = await prisma.activeState.findMany({ where: { isActive: true }, select: { state: true } });
    const activeStateList = activeStates.map((s) => s.state);
    // Match on every spelling a state is stored under. ActiveState holds
    // two-letter codes while user.state holds whatever the signup form
    // produced — production has both "pennsylvania" and "CA" — so comparing
    // the raw values filtered out every pro saved with a full name, which was
    // all of them in some states and made this endpoint return nothing at all.
    const stateFilter =
      activeStateList.length > 0 ? { in: stateAliases(activeStateList) } : undefined;

    const handymen = await prisma.handymanProfile.findMany({
      where: {
        backgroundCheckStatus: "PASSED",
        services: { some: { category: category as never, isActive: true } },
        user: {
          // Deletion anonymizes rather than erases, leaving a PASSED profile
          // with live services behind. See lib/rate-range.ts.
          isActive: true,
          avatarUrl: { not: null },
          // A dual-role account shouldn't see itself as a bookable handyman.
          ...(user ? { id: { not: user.id } } : {}),
          ...(stateFilter ? { state: stateFilter } : {}),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            accountType: true,
            companyName: true,
            companyLogoUrl: true,
          },
        },
        availability: { select: { dayOfWeek: true, startHour: true, endHour: true } },
        services: {
          where: { category: category as never, isActive: true },
          // hourlyRate deliberately not selected — see the note in
          // /api/handyman/browse. This is a list; the rate belongs on a detail view.
          select: { id: true, title: true, duration: true },
          take: 1,
        },
      },
    });

    const customerLat = user?.latitude ?? null;
    const customerLon = user?.longitude ?? null;

    const results = handymen
      .map((h) => {
        const distanceKm =
          customerLat && customerLon && h.user.latitude && h.user.longitude
            ? haversine(customerLat, customerLon, h.user.latitude, h.user.longitude)
            : null;
        return {
          id: h.id,
          userId: h.user.id,
          name: h.user.name,
          avatarUrl: h.user.avatarUrl,
          accountType: h.user.accountType,
          companyName: h.user.companyName,
          companyLogoUrl: h.user.companyLogoUrl,
          city: h.user.city,
          state: h.user.state,
          bio: h.bio,
          rating: h.rating,
          totalJobs: h.totalJobs,
          yearsExperience: h.yearsExperience,
          responseTime: h.responseTime,
          serviceRadius: h.serviceRadius,
          isElite: h.rating >= 4.5 && h.totalJobs >= 10,
          isPremium: h.isPremium,
          backgroundCheckStatus: h.backgroundCheckStatus,
          distanceKm,
          ...(() => {
            const { licensed, insured } = credentialBadges(h);
            const rankable = {
              rating: h.rating,
              totalJobs: h.totalJobs,
              responseTime: h.responseTime ?? 60,
              yearsExperience: h.yearsExperience,
              isPremium: h.isPremium,
              distanceKm,
              licensed,
              insured,
            };
            // See lib/matching.ts. Credentials tier ABOVE the score; within a
            // tier quality leads, distance decays, and paid placement is capped
            // so it cannot outrank being good.
            return {
              licensed,
              insured,
              // A licence tiers only in a regulated trade; insurance always does.
              credentialTier: credentialTier(rankable, licenseMatters(category)),
              score: matchScore(rankable),
              // What the customer is shown: a band and the reasons behind it,
              // as codes the apps localise.
              match: matchQuality(rankable),
            };
          })(),
          availableAtRequestedTime: when ? isAvailableAt(h.availability ?? [], when) : true,
          // Coordinates deliberately not returned — see the note in
          // /api/handyman/browse. distanceKm is what the client needs.
          service: h.services[0] ?? null,
        };
      })
      // Only apply distance filter when customer location is known
      .filter((h) => h.distanceKm === null || h.distanceKm <= RADIUS_KM)
      // For roofing and HVAC, an unlicensed pro is not a worse match — they
      // cannot lawfully take the job at all, and POST /bookings refuses them.
      // Ranking them lower would list somebody the customer can pick and only
      // be turned away at checkout, which is the refusal-at-the-last-step
      // failure the apply route already avoids. This is the one place a
      // credential excludes rather than sorts.
      //
      // Note this CAN empty the list where no licensed pro exists yet. That is
      // the honest answer for permitted work, and better than a lineup nobody
      // in it may accept — the radius fallback below deliberately does not
      // cover it.
      .filter((h) => !licenseAlwaysRequired(category) || (h.licensed && h.insured))
      // Whoever can actually do it, best fit first.
      //
      // This used to sort by distance and only break ties on score, so a
      // three-star pro two miles away outranked a 4.9-star pro six miles away.
      // Distance is now one weighted input rather than the sort key.
      // Availability sorts, it does not exclude.
      //
      // As a hard filter it can only ever reduce the list, and with supply
      // still thin that means showing nobody — which is worse for the customer
      // than showing a pro who may need a different time. Whoever is free when
      // they asked comes first; everyone else is still reachable below.
      .sort((a, b) => {
        const avail = Number(b.availableAtRequestedTime) - Number(a.availableAtRequestedTime);
        if (avail !== 0) return avail;
        // Licensed and insured first — the credential outranks the score,
        // because the risk it covers does not shrink as a rating improves.
        const tier = b.credentialTier - a.credentialTier;
        return tier !== 0 ? tier : b.score - a.score;
      });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
