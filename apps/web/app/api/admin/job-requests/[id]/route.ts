import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geo/geocode";
import { notifyProsOfJob } from "@/lib/job-fanout";
import { createNotification } from "@/lib/notify";

// Repair a DRAFT job's address and publish it.
//
// A DRAFT exists because geocoding rejected the address, which means the job is
// invisible to pros and unappliable while the customer believes it is live.
// Usually one wrong digit. This corrects the address, geocodes the CORRECTED
// text, and only publishes if it resolves.
//
// It deliberately does NOT accept coordinates or a status directly. Letting an
// admin set status="OPEN" by hand would publish a job with no usable location,
// which is the exact state the DRAFT path exists to prevent — the request would
// then pass every radius check in the system, since those read
// `distanceKm === null || within range`.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await prisma.jobRequest.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "DRAFT") {
    return NextResponse.json(
      { error: `Only a DRAFT job can be published. This one is ${job.status}.` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === "string" && body.address.trim()
    ? body.address.trim()
    : job.address;
  const city = typeof body.city === "string" && body.city.trim()
    ? body.city.trim()
    : job.city;

  const geo = await geocodeAddress(`${address}, ${city}`, { country: "US" });

  // Still unresolvable: save the correction so the next attempt starts from the
  // better text, record the new reason, and leave it a DRAFT.
  if (geo.decision.outcome === "reject" || !geo.coords) {
    const message = geo.decision.outcome === "reject" ? geo.decision.message : "No coordinates returned";
    await prisma.jobRequest.update({
      where: { id: job.id },
      data: { address, city, geocodeError: message, geocodeSource: geo.decision.outcome, geocodedAt: new Date() },
    });
    return NextResponse.json(
      { published: false, error: message, address, city },
      { status: 422 },
    );
  }

  const published = await prisma.jobRequest.update({
    where: { id: job.id },
    data: {
      address,
      city,
      latitude: geo.coords.lat,
      longitude: geo.coords.lng,
      status: "OPEN",
      geocodeError: null,
      geocodeSource: geo.decision.outcome,
      geocodedAt: new Date(),
    },
  });

  // Publishing without this puts the job in every Find Jobs list and in nobody's
  // notifications — invisible in a different way than before.
  const notified = await notifyProsOfJob(published);

  // The customer was never told their job was held, so tell them it is live now
  // rather than let it appear silently.
  await createNotification({
    userId: published.customerId,
    title: "Your job is live",
    body: `We fixed the address on "${published.title}" and it is now visible to pros.`,
    type: "booking_request",
    refId: published.id,
  });

  return NextResponse.json({ published: true, notified, address, city });
}
