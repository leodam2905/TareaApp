import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { milesFromKmOrNull } from "@/lib/units";

// A pro's own applications.
//
// Applying used to drop a job into a hole: /job-requests excludes anything the
// pro has applied to, and /bookings only lists work that already exists — a
// booking is created when the customer HIRES, which may be days later or never.
// So between applying and being hired, a pro had nowhere to see the job, and
// the "Applied" badge lived only in one screen's memory and vanished on
// restart. Pros reported jobs "disappearing".

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json([]);

  const applications = await prisma.jobApplication.findMany({
    where: { handymanId: profile.id },
    orderBy: { createdAt: "desc" },
    include: {
      jobRequest: {
        include: { customer: { select: { name: true, city: true, avatarUrl: true } } },
      },
    },
  });

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { latitude: true, longitude: true },
  });

  return NextResponse.json(
    applications.map((a) => {
      const jr = a.jobRequest;
      const distanceKm =
        me?.latitude != null && me?.longitude != null && jr.latitude != null && jr.longitude != null
          ? haversine(me.latitude, me.longitude, jr.latitude, jr.longitude)
          : null;
      return {
        id: a.id,
        status: a.status,
        message: a.message,
        materialsEstimate: a.materialsEstimate,
        createdAt: a.createdAt,
        // The job as the pro needs to see it — enough to render a card without
        // a second round trip per application.
        jobRequest: {
          id: jr.id,
          title: jr.title,
          description: jr.description,
          category: jr.category,
          city: jr.city,
          scheduledAt: jr.scheduledAt,
          budgetMin: jr.budgetMin,
          budgetMax: jr.budgetMax,
          materialsCost: jr.materialsCost,
          urgency: jr.urgency,
          // ASSIGNED means somebody was hired. Paired with this application's
          // own status it tells the pro whether they lost the job or the
          // customer simply has not decided yet.
          status: jr.status,
          customer: jr.customer,
        },
        distanceKm,
        distanceMiles: milesFromKmOrNull(distanceKm),
      };
    }),
  );
}
