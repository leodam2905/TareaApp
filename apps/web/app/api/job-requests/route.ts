import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";

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

  // Block handymen without a photo or passed background check
  const handymanUser = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  if (!handymanUser?.avatarUrl) return NextResponse.json({ requiresPhoto: true });
  if (profile.backgroundCheckStatus !== "PASSED") return NextResponse.json({ requiresCheck: true });

  const requests = await prisma.jobRequest.findMany({
    where: {
      status: "OPEN",
      category: { in: myCategories as never[] },
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
      latitude:  latitude  ? parseFloat(latitude)  : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      scheduledAt: new Date(scheduledAt),
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    },
  });

  // Notify matching handymen — only PASSED background check + photo + available + matching service
  const handymen = await prisma.handymanProfile.findMany({
    where: {
      isAvailable: true,
      backgroundCheckStatus: "PASSED",
      user: { avatarUrl: { not: null } },
      services: { some: { category: category as never, isActive: true } },
    },
    include: { user: { select: { id: true, city: true, email: true, name: true, expoPushToken: true } } },
  });

  const nearby = handymen.filter(h => h.user.city?.toLowerCase() === city.toLowerCase());

  if (nearby.length > 0) {
    // In-app notifications (bulk)
    await prisma.notification.createMany({
      data: nearby.map(h => ({
        userId: h.user.id,
        title: "New Job Near You",
        body: `"${title}" posted in ${city}. Apply before it's taken!`,
        type: "booking_request",
        refId: jobRequest.id,
      })),
    });

    // Email + push per handyman (fire and forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com";
    const jobUrl = `${appUrl}/handyman/find-jobs`;
    const budgetStr = `$${parseFloat(budgetMin).toFixed(0)}–$${parseFloat(budgetMax).toFixed(0)}`;
    const categoryLabel = category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

    await Promise.allSettled(nearby.map(async h => {
      // Push notification
      if (h.user.expoPushToken) {
        await sendPush(
          h.user.expoPushToken,
          "New Job Near You 🔧",
          `${title} in ${city} — Budget ${budgetStr}`,
          { screen: "FindJobs", jobId: jobRequest.id }
        );
      }

      // Email notification
      await sendEmail(
        h.user.email,
        `New ${categoryLabel} job near you — ${city}`,
        "New Job Opportunity Near You",
        `A customer just posted a <strong>${categoryLabel}</strong> job in <strong>${city}</strong>.<br><br>
        <strong>${title}</strong><br>
        Budget: ${budgetStr}<br><br>
        ${description.slice(0, 200)}${description.length > 200 ? "…" : ""}<br><br>
        Apply now before another Pro takes it!`,
        { label: "View Job & Apply", url: jobUrl }
      );
    }));
  }

  return NextResponse.json(jobRequest, { status: 201 });
}
