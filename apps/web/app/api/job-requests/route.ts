import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";

const RADIUS_KM = 50 * 1.60934;

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

  // Handyman: return ALL open requests, optionally filtered by their service categories
  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json([]);

  const myServices = await prisma.service.findMany({
    where: { handymanId: profile.id, isActive: true },
    select: { category: true },
  });
  const myCategories = myServices.map(s => s.category);

  // Jobs over $500 are reserved for Licensed & Insured pros (license + insurance on file).
  const docs = await prisma.handymanProfile.findUnique({
    where: { id: profile.id }, select: { licenseDocUrl: true, insuranceDocUrl: true },
  });
  const licensedInsured = !!(docs?.licenseDocUrl && docs?.insuranceDocUrl);

  const requests = await prisma.jobRequest.findMany({
    where: {
      status: "OPEN",
      ...(myCategories.length > 0 ? { category: { in: myCategories as never[] } } : {}),
      applications: { none: { handymanId: profile.id } },
    },
    include: {
      customer: { select: { name: true, city: true, avatarUrl: true } },
      applications: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const handymanUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { latitude: true, longitude: true },
  });

  const scored = requests
    .map(r => {
      const distanceKm =
        handymanUser?.latitude && handymanUser?.longitude && r.latitude && r.longitude
          ? haversine(handymanUser.latitude, handymanUser.longitude, r.latitude, r.longitude)
          : null;
      return { ...r, distanceKm, score: 0 };
    })
    .filter(r => r.distanceKm === null || r.distanceKm <= RADIUS_KM)
    // Jobs whose LABOR value (budget minus furniture/materials the customer buys)
    // exceeds $500 are reserved for Licensed & Insured pros.
    .filter(r => licensedInsured || (r.budgetMax - (r.materialsCost ?? 0)) <= 500)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  return NextResponse.json(scored);
}

// Customer creates a job request
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, title, description, address, city, scheduledAt, budgetMin, budgetMax, materialsCost, latitude, longitude, imageUrls } = await req.json();

  if (!category || !title || !description || !address || !city || !scheduledAt) {
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
      budgetMin: budgetMin ? parseFloat(budgetMin) : 0,
      budgetMax: budgetMax ? parseFloat(budgetMax) : 0,
      materialsCost: materialsCost ? parseFloat(materialsCost) : 0,
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
    include: { user: { select: { id: true, city: true, email: true, name: true, expoPushToken: true, fcmToken: true, latitude: true, longitude: true } } },
  });

  // Match by distance (catches pros in nearby towns, not just an exact city-name
  // match). Fall back to city only when coordinates are missing on either side.
  const jLat = jobRequest.latitude, jLng = jobRequest.longitude;
  const nearby = handymen.filter(h => {
    const u = h.user;
    if (jLat != null && jLng != null && u.latitude != null && u.longitude != null) {
      return haversine(jLat, jLng, u.latitude, u.longitude) <= RADIUS_KM;
    }
    return u.city?.toLowerCase() === city.toLowerCase();
  });

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
    const budgetStr = (budgetMin || budgetMax)
      ? `$${parseFloat(budgetMin || "0").toFixed(0)}–$${parseFloat(budgetMax || "0").toFixed(0)}`
      : "Open / flexible";
    const categoryLabel = category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

    await Promise.allSettled(nearby.map(async h => {
      // Push notification (Expo for RN app, FCM for Flutter app)
      for (const tok of [h.user.expoPushToken, h.user.fcmToken]) {
        if (tok) {
          await sendPush(
            tok,
            "New Job Near You 🔧",
            `${title} in ${city} — Budget ${budgetStr}`,
            { screen: "FindJobs", jobId: jobRequest.id }
          );
        }
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
