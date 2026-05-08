import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Customer: get own requests  |  Handyman: get matching open requests
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "CUSTOMER") {
    const requests = await prisma.jobRequest.findMany({
      where: { customerId: user.id },
      include: {
        applications: {
          include: {
            user: { select: { name: true, avatarUrl: true } },
            handyman: { select: { rating: true, totalJobs: true, bio: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  }

  // Handyman: return OPEN requests matching their service categories
  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json([]);

  const myServices = await prisma.service.findMany({
    where: { handymanId: profile.id, isActive: true },
    select: { category: true },
  });
  const myCategories = myServices.map(s => s.category);

  const requests = await prisma.jobRequest.findMany({
    where: {
      status: "OPEN",
      category: { in: myCategories as never[] },
      // Exclude requests the handyman already applied to
      applications: { none: { handymanId: profile.id } },
    },
    include: {
      customer: { select: { name: true, city: true, avatarUrl: true } },
      applications: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Sort by proximity + recency
  const myUser = await prisma.user.findUnique({ where: { id: user.id }, select: { latitude: true, longitude: true, city: true } });

  const scored = requests.map(r => {
    const cityMatch = myUser?.city?.toLowerCase() === r.city.toLowerCase();
    let distanceKm: number | null = null;
    if (myUser?.latitude && myUser?.longitude && r.latitude && r.longitude) {
      distanceKm = haversine(myUser.latitude, myUser.longitude, r.latitude, r.longitude);
    }
    const distanceScore = distanceKm !== null ? Math.max(0, 100 - distanceKm) : 0;
    const score = (cityMatch ? 50 : 0) + distanceScore;
    return { ...r, distanceKm, score };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(scored);
}

// Customer creates a job request
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, title, description, address, city, scheduledAt, budgetMin, budgetMax, latitude, longitude, imageUrls } = await req.json();

  if (!category || !title || !description || !address || !city || !scheduledAt || !budgetMin || !budgetMax) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const jobRequest = await prisma.jobRequest.create({
    data: {
      customerId: user.id,
      category,
      title,
      description,
      address,
      city,
      latitude,
      longitude,
      scheduledAt: new Date(scheduledAt),
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    },
  });

  // Notify matching handymen
  const handymen = await prisma.handymanProfile.findMany({
    where: { isAvailable: true, services: { some: { category: category as never, isActive: true } } },
    include: { user: { select: { id: true, city: true } } },
  });

  const nearby = handymen.filter(h => h.user.city?.toLowerCase() === city.toLowerCase());
  if (nearby.length > 0) {
    await prisma.notification.createMany({
      data: nearby.map(h => ({
        userId: h.user.id,
        title: "New Job Near You",
        body: `"${title}" posted in ${city}. Check Find Jobs to apply!`,
        type: "booking_request",
        refId: jobRequest.id,
      })),
    });
  }

  return NextResponse.json(jobRequest, { status: 201 });
}
