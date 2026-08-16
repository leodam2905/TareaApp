import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unmetSteps } from "@/lib/pro-bookable";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; appId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobRequest = await prisma.jobRequest.findUnique({
    where: { id: params.id },
    include: { applications: true },
  });
  if (!jobRequest || jobRequest.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { action } = await req.json();

  // Ensure the application actually belongs to this job request (prevents
  // accepting/rejecting an application from a different customer's job request
  // by passing a foreign appId).
  if (!jobRequest.applications.some((a) => a.id === params.appId)) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Fetch (don't update yet) — the safety gate must run BEFORE we mark the
  // application accepted, so a blocked hire doesn't leave a phantom ACCEPTED
  // application with no booking.
  const application = await prisma.jobApplication.findUnique({
    where: { id: params.appId },
    include: { handyman: { include: { user: true } }, user: true },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (action === "accept") {
    // Bookable means all six onboarding steps complete — the same rule browse
    // filters on and applying asserts. Checked again here because this is the
    // moment a stranger is sent to somebody's home, and it must not depend on
    // an earlier surface having been correct.
    const handymanProfile = await prisma.handymanProfile.findUnique({
      where: { id: application.handymanId },
      select: { backgroundCheckStatus: true, icaSignedAt: true, bio: true, idFrontUrl: true },
    });
    const handymanUserRecord = await prisma.user.findUnique({
      where: { id: application.user.id },
      select: { avatarUrl: true, stripeAccountStatus: true },
    });
    const [hmServices, hmAvailability] = await Promise.all([
      prisma.service.count({ where: { handymanId: application.handymanId } }),
      prisma.handymanAvailability.count({ where: { profileId: application.handymanId } }),
    ]);
    const proMissing = unmetSteps({
      avatarUrl: handymanUserRecord?.avatarUrl ?? null,
      stripeAccountStatus: handymanUserRecord?.stripeAccountStatus ?? null,
      profile: handymanProfile
        ? {
            icaSignedAt: handymanProfile.icaSignedAt,
            bio: handymanProfile.bio,
            idFrontUrl: handymanProfile.idFrontUrl,
            backgroundCheckStatus: handymanProfile.backgroundCheckStatus as string,
            servicesCount: hmServices,
            availabilityCount: hmAvailability,
          }
        : null,
    });
    if (proMissing.length > 0) {
      return NextResponse.json(
        { error: "This Pro has not finished setting up and cannot be booked yet." },
        { status: 400 },
      );
    }

    // Gate passed — now mark accepted, assign, and reject the others.
    await prisma.jobApplication.update({ where: { id: params.appId }, data: { status: "ACCEPTED" } });
    await prisma.jobRequest.update({ where: { id: params.id }, data: { status: "ASSIGNED" } });
    await prisma.jobApplication.updateMany({
      where: { jobRequestId: params.id, id: { not: params.appId } },
      data: { status: "REJECTED" },
    });

    // A hire must ALWAYS produce a customer booking. Use the pro's matching
    // service if they have one; otherwise create a private (inactive) service
    // from the job so a booking can exist even when the pro has no listing in
    // this category.
    let service = await prisma.service.findFirst({
      where: { handymanId: application.handymanId, category: jobRequest.category },
      orderBy: { isActive: "desc" },
    });
    if (!service) {
      // The labour price is the job's, never the applicant's — see totalPrice below.
      const price = jobRequest.budgetMin ?? 0;
      service = await prisma.service.create({
        data: {
          handymanId: application.handymanId,
          title: jobRequest.title,
          description: (jobRequest.description || jobRequest.title).slice(0, 500),
          category: jobRequest.category,
          minPrice: price,
          maxPrice: jobRequest.budgetMax ?? price,
          duration: 60,
          isActive: false,
        },
      });
    }

    // Both parties agreed (pro applied, customer hired) → create the booking
    // ACCEPTED so the customer can pay right away.
    const booking = await prisma.booking.create({
      data: {
        customerId: user.id,
        handymanId: application.user.id,
        serviceId: service.id,
        status: "ACCEPTED",
        scheduledAt: jobRequest.scheduledAt,
        address: jobRequest.address,
        city: jobRequest.city,
          // Tarea sets the labour price; a pro cannot bid it up or change it.
          // This previously preferred the applicant's proposed figure over the
          // job's, so whatever a pro typed became the amount the customer owed:
          // they agreed to one number and could be billed another.
          totalPrice: jobRequest.budgetMin,
        materialsEstimate: application.materialsEstimate ?? jobRequest.materialsCost ?? 0,
        responseDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    await createNotification({
      userId: application.user.id,
      title: "Application Accepted!",
      body: `You got the job: "${jobRequest.title}". Check your Jobs tab.`,
      type: "booking_accepted",
      refId: booking.id,
    });
    // Prompt the customer to pay & confirm their new booking.
    await createNotification({
      userId: user.id,
      title: "Pro hired — confirm & pay",
      body: `You hired ${application.user.name} for "${jobRequest.title}". Open the booking to pay and confirm.`,
      type: "booking_accepted",
      refId: booking.id,
    });
  } else {
    await prisma.jobApplication.update({ where: { id: params.appId }, data: { status: "REJECTED" } });
    await createNotification({
      userId: application.user.id,
      title: "Application Not Selected",
      body: `The customer chose another handyman for "${jobRequest.title}".`,
      type: "booking_request",
      refId: jobRequest.id,
    });
  }

  return NextResponse.json({ ok: true });
}
