import { NextRequest, NextResponse } from "next/server";
import { stateAliases } from "@/lib/us-states";
import { matchScore, isAvailableAt } from "@/lib/matching";
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
          select: { id: true, title: true, minPrice: true, maxPrice: true, duration: true },
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
          hourlyRate: h.hourlyRate,
          yearsExperience: h.yearsExperience,
          responseTime: h.responseTime,
          serviceRadius: h.serviceRadius,
          isElite: h.rating >= 4.5 && h.totalJobs >= 10,
          isPremium: h.isPremium,
          backgroundCheckStatus: h.backgroundCheckStatus,
          distanceKm,
          // See lib/matching.ts. Quality leads, distance decays, paid
          // placement is capped so it cannot outrank being good.
          score: matchScore({
            rating: h.rating,
            totalJobs: h.totalJobs,
            responseTime: h.responseTime ?? 60,
            isPremium: h.isPremium,
            distanceKm,
          }),
          availableAtRequestedTime: when ? isAvailableAt(h.availability ?? [], when) : true,
          // Coordinates deliberately not returned — see the note in
          // /api/handyman/browse. distanceKm is what the client needs.
          service: h.services[0] ?? null,
        };
      })
      // Only apply distance filter when customer location is known
      .filter((h) => h.distanceKm === null || h.distanceKm <= RADIUS_KM)
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
        return avail !== 0 ? avail : b.score - a.score;
      });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
