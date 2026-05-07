import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const KM_PER_MILE = 1.60934;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const dateStr = searchParams.get("date");
    const city = searchParams.get("city");

    if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });

    // User may not be logged in — that's fine
    let user = null;
    try { user = await getCurrentUser(); } catch { /* unauthenticated */ }

    // Parse as UTC so "2026-04-29T10:00" always means day=Wed, hour=10
    // regardless of the server's local timezone
    let requestedDay: number | null = null;
    let requestedHour: number | null = null;
    if (dateStr) {
      const normalized = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
      const d = new Date(normalized);
      requestedDay = d.getUTCDay();
      requestedHour = d.getUTCHours();
    }

    // Restrict to active states (if any are configured)
    const activeStates = await prisma.activeState.findMany({ where: { isActive: true }, select: { state: true } });
    const activeStateList = activeStates.map((s) => s.state);
    const stateFilter = activeStateList.length > 0 ? { in: activeStateList } : undefined;

    const handymen = await prisma.handymanProfile.findMany({
      where: {
        isAvailable: true,
        services: { some: { category: category as never, isActive: true } },
        ...(stateFilter ? { user: { state: stateFilter } } : {}),
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
        availability: true,
        // backgroundCheckStatus included as scalar via default select
      },
    });
    // Note: isPremium is a scalar field included by default via findMany

    const customerCity = (user?.city || city || "").toLowerCase();
    const customerLat = user?.latitude ?? null;
    const customerLon = user?.longitude ?? null;

    const results = handymen
      .map((h) => {
        // Availability: if no slots configured → always available
        let isAvailableOnDate = true;
        if (requestedDay !== null && h.availability.length > 0) {
          const slot = h.availability.find((a) => a.dayOfWeek === requestedDay);
          if (!slot) {
            isAvailableOnDate = false;
          } else if (requestedHour !== null) {
            isAvailableOnDate = requestedHour >= slot.startHour && requestedHour < slot.endHour;
          }
        }

        let distanceKm: number | null = null;
        if (customerLat && customerLon && h.user.latitude && h.user.longitude) {
          distanceKm = haversine(customerLat, customerLon, h.user.latitude, h.user.longitude);
        }

        const isElite = h.rating >= 4.5 && h.totalJobs >= 10;
        const cityMatch = customerCity && h.user.city?.toLowerCase() === customerCity;
        const distanceScore = distanceKm !== null ? Math.max(0, 50 - distanceKm * 0.5) : 0;
        const score =
          (cityMatch ? 40 : 0) + distanceScore + h.rating * 8 + Math.min(h.totalJobs, 25) + (isElite ? 15 : 0) + (h.isPremium ? 25 : 0);

        // Filter by service radius: if distance is known and exceeds radius, exclude
        const withinRadius = distanceKm === null || distanceKm <= h.serviceRadius * KM_PER_MILE;

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
          isElite,
          isPremium: h.isPremium,
          backgroundCheckStatus: h.backgroundCheckStatus,
          distanceKm,
          score,
          isAvailableOnDate,
          withinRadius,
          latitude: h.user.latitude,
          longitude: h.user.longitude,
          service: h.services[0] ?? null,
        };
      })
      .filter((h) => h.isAvailableOnDate && h.withinRadius)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
