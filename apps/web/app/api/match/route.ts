import { NextRequest, NextResponse } from "next/server";
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
    const category = searchParams.get("category");

    if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });

    let user = null;
    try { user = await getCurrentUser(); } catch { /* unauthenticated */ }

    // Restrict to active states (if any are configured)
    const activeStates = await prisma.activeState.findMany({ where: { isActive: true }, select: { state: true } });
    const activeStateList = activeStates.map((s) => s.state);
    const stateFilter = activeStateList.length > 0 ? { in: activeStateList } : undefined;

    const handymen = await prisma.handymanProfile.findMany({
      where: {
        backgroundCheckStatus: "PASSED",
        services: { some: { category: category as never, isActive: true } },
        user: {
          avatarUrl: { not: null },
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
          score: h.rating * 8 + Math.min(h.totalJobs, 25) + (h.isPremium ? 25 : 0),
          latitude: h.user.latitude,
          longitude: h.user.longitude,
          service: h.services[0] ?? null,
        };
      })
      // Only apply distance filter when customer location is known
      .filter((h) => h.distanceKm === null || h.distanceKm <= RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || b.score - a.score);

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
