import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { sendSms } from "@/lib/sms";
import { smsBody, createNotification } from "@/lib/notify";
import { geocodeAddress } from "@/lib/geo/geocode";

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
      // GENERAL is included for every pro, matching the notification fan-out.
      // If these two disagreed a pro would get the push and then find nothing
      // in the list, which is worse than not being told at all.
      ...(myCategories.length > 0
          ? { category: { in: myCategories.concat("GENERAL" as never).filter((c, n, a) => a.indexOf(c) === n) as never[] } }
        : {}),
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

  const { category, title, description, address, city, scheduledAt, budgetMin, budgetMax, materialsCost, latitude, longitude, imageUrls, urgency } = await req.json();

  if (!category || !title || !description || !address || !city || !scheduledAt) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Geocode what the customer actually typed.
  //
  // The app sends the PHONE's position, and only when location permission was
  // granted — so a job posted from the sofa for a house across town was located
  // at the sofa, and one posted with permission denied had no position at all.
  // The address is the job's location; the phone is not. Client coordinates are
  // kept only as a fallback for when geocoding cannot resolve the address.
  let geoLat: number | undefined = latitude ? parseFloat(latitude) : undefined;
  let geoLng: number | undefined = longitude ? parseFloat(longitude) : undefined;

  const geo = await geocodeAddress(`${address}, ${city}`, { country: "US" });
  if (geo.coords) {
    geoLat = geo.coords.lat;
    geoLng = geo.coords.lng;
  }

  const jobRequest = await prisma.jobRequest.create({
    data: {
      customerId: user.id,
      category,
      title,
      description,
      address,
      city,
      latitude:  geoLat,
      longitude: geoLng,
      scheduledAt: new Date(scheduledAt),
      budgetMin: budgetMin ? parseFloat(budgetMin) : 0,
      budgetMax: budgetMax ? parseFloat(budgetMax) : 0,
      materialsCost: materialsCost ? parseFloat(materialsCost) : 0,
      urgency: ["STANDARD", "SOON", "URGENT"].includes(urgency) ? urgency : "STANDARD",
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    },
  });

  // Who hears about a new job: every APPROVED pro who is ONLINE.
  //
  // A missing profile photo used to exclude a pro here. That is a display
  // concern — it belongs on the browse surface a customer sees, not on whether
  // somebody is told work exists. An approved, available pro silently not
  // hearing about a job is the same failure this whole path keeps producing.
  const handymen = await prisma.handymanProfile.findMany({
    where: {
      isAvailable: true,
      backgroundCheckStatus: "PASSED",
      // GENERAL is the AI's catch-all: anything it cannot place lands there.
      // Few pros register for it, so those jobs reached nobody at all — no
      // push, no SMS, and no row in Find Jobs, in complete silence. A GENERAL
      // job therefore goes to every otherwise-eligible pro; specific
      // categories still match exactly.
      ...(category === "GENERAL"
        ? {}
        : { services: { some: { category: category as never, isActive: true } } }),
    },
    include: { user: { select: { id: true, city: true, email: true, name: true, expoPushToken: true, fcmToken: true, latitude: true, longitude: true, phone: true, notifSms: true } } },
  });

  // Match by distance (catches pros in nearby towns, not just an exact city-name
  // match). Fall back to city only when coordinates are missing on either side.
  //
  // A pro is excluded only on positive evidence they're out of range. Missing
  // coordinates or a blank city are gaps in our own data, not a signal the pro
  // is far away — treating them as a mismatch meant an open job could notify
  // nobody at all while still appearing in every pro's Find Jobs list (GET
  // applies no location filter), which is how this stayed invisible.
  const jLat = jobRequest.latitude, jLng = jobRequest.longitude;
  const nearby = handymen.filter(h => {
    const u = h.user;
    if (jLat != null && jLng != null && u.latitude != null && u.longitude != null) {
      return haversine(jLat, jLng, u.latitude, u.longitude) <= RADIUS_KM;
    }
    // Without coordinates on both sides we genuinely cannot tell how far apart
    // these are, and a city name is not a proxy for distance: Darby and Crum
    // Lynne are a few miles apart and compare unequal. Excluding on that
    // mismatch meant a job in a neighbouring town notified nobody at all, while
    // still appearing in every pro's Find Jobs list — so pros only ever found
    // work by opening the app. Notify every otherwise-eligible pro and let them
    // judge the distance. Under-notifying is fatal for a marketplace;
    // over-notifying is noise. Remove once addresses are geocoded at post time.
    return true;
  });

  if (nearby.length > 0) {
    const isUrgent = jobRequest.urgency === "URGENT";
    const pushTitle = isUrgent ? "🚨 Urgent Job Near You" : "New Job Near You 🔧";

    // In-app notifications (bulk)
    await prisma.notification.createMany({
      data: nearby.map(h => ({
        userId: h.user.id,
        title: isUrgent ? "🚨 Urgent Job Near You" : "New Job Near You",
        body: `${isUrgent ? "URGENT — " : ""}"${title}" posted in ${city}. Apply before it's taken!`,
        type: "booking_request",
        refId: jobRequest.id,
      })),
    });

    // Email + push per handyman. NB this is awaited, not fire-and-forget: the
    // customer's response waits on it. Moving email onto a queue is the next
    // step — a floating promise isn't safe here, since Cloud Run throttles CPU
    // once the response is sent.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com";
    const jobUrl = `${appUrl}/handyman/find-jobs`;
    const budgetStr = (budgetMin || budgetMax)
      ? `$${parseFloat(budgetMin || "0").toFixed(0)}–$${parseFloat(budgetMax || "0").toFixed(0)}`
      : "Open / flexible";
    const categoryLabel = category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

    // Push and email run concurrently per pro rather than in sequence: the push
    // is the time-critical signal and shouldn't queue behind an email delivery.
    await Promise.allSettled(nearby.map(async h => Promise.all([
      // Push to every device this handyman has registered (prunes dead tokens).
      sendPushToUser(
        h.user.id,
        pushTitle,
        `${isUrgent ? "URGENT · " : ""}${title} in ${city} — Budget ${budgetStr}`,
        { type: "booking_request", screen: "FindJobs", jobId: jobRequest.id, urgent: isUrgent }
      ),

      // SMS. This fan-out does not go through createNotification, so the SMS
      // that every other pro/customer interaction gets has to be sent here
      // too — and this is the one that matters most, because a pro who never
      // learns a job exists cannot take it. Push can be silently dropped and
      // email can sit unread; a text is the floor under both.
      //
      // Trimmed to one 160-character segment: this fans out to every eligible
      // pro, so an extra segment is billed per pro per job, not once.
      (h.user.notifSms && h.user.phone
        ? sendSms(
            h.user.phone,
            smsBody(
              `${isUrgent ? "URGENT " : ""}New ${categoryLabel} job in ${city}`,
              `${title} — Budget ${budgetStr}`,
              jobUrl,
            ),
          )
        : Promise.resolve()),

      // Email notification
      sendEmail(
        h.user.email,
        `New ${categoryLabel} job near you — ${city}`,
        "New Job Opportunity Near You",
        `A customer just posted a <strong>${categoryLabel}</strong> job in <strong>${city}</strong>.<br><br>
        <strong>${title}</strong><br>
        Budget: ${budgetStr}<br><br>
        ${description.slice(0, 200)}${description.length > 200 ? "…" : ""}<br><br>
        Apply now before another Pro takes it!`,
        { label: "View Job & Apply", url: jobUrl }
      ),
    ])));
  }

  // A job nobody can see is the marketplace's worst failure, and it used to
  // happen in silence: the block above is skipped, and the customer is still
  // told their request is live. Record it and tell the admins, so a hole in
  // coverage is something somebody knows about.
  if (nearby.length === 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.allSettled(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          title: "Job reached no pros",
          body: `"${title}" (${category}) in ${city} matched no available pro. The customer has not been told.`,
          type: "booking_cancelled",
          refId: jobRequest.id,
        }),
      ),
    );
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "job_reached_no_pros",
        jobId: jobRequest.id,
        category,
        city,
        geocoded: geo.decision.outcome,
      }),
    );
  }

  // Confirmation to the customer on their own device.
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: "Job posted",
      body: `Your "${title}" request is live. We'll let you know when a pro applies.`,
      type: "booking_request",
      refId: jobRequest.id,
    },
  });
  await sendPushToUser(
    user.id,
    "Job posted ✅",
    `Your "${title}" request is live — we'll notify you when a pro applies.`,
    { type: "booking_request", screen: "Requests", jobId: jobRequest.id }
  );

  return NextResponse.json(jobRequest, { status: 201 });
}
