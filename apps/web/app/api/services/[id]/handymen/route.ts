import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Haversine distance in km between two lat/lng points
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find handymen who have an active service in this category
  const handymen = await prisma.handymanProfile.findMany({
    where: {
      isAvailable: true,
      services: { some: { category: service.category, isActive: true } },
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
        },
      },
      services: {
        where: { category: service.category, isActive: true },
        select: { minPrice: true, maxPrice: true },
        take: 1,
      },
    },
  });

  // Score each handyman: city match + distance + rating
  const customerCity = user?.city?.toLowerCase();
  const customerLat = user?.latitude;
  const customerLon = user?.longitude;

  const scored = handymen.map((h) => {
    const cityMatch = customerCity && h.user.city?.toLowerCase() === customerCity;
    let distanceKm: number | null = null;

    if (customerLat && customerLon && h.user.latitude && h.user.longitude) {
      distanceKm = haversine(customerLat, customerLon, h.user.latitude, h.user.longitude);
    }

    // Score: city match worth 50pts, distance score (closer = higher), rating up to 10pts
    const distanceScore = distanceKm !== null ? Math.max(0, 100 - distanceKm) : 0;
    const score = (cityMatch ? 50 : 0) + distanceScore + h.rating * 10;

    return { ...h, distanceKm, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json(scored);
}
