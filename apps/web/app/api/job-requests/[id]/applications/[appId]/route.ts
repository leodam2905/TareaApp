import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

  const application = await prisma.jobApplication.update({
    where: { id: params.appId },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
    include: { handyman: { include: { user: true } }, user: true },
  });

  if (action === "accept") {
    // Safety gate — handyman must have photo + passed background check before booking
    const handymanProfile = await prisma.handymanProfile.findUnique({
      where: { id: application.handymanId },
      select: { backgroundCheckStatus: true },
    });
    const handymanUserRecord = await prisma.user.findUnique({
      where: { id: application.user.id },
      select: { avatarUrl: true },
    });

    if (!handymanUserRecord?.avatarUrl) {
      return NextResponse.json({ error: "This handyman has not uploaded a profile photo yet and cannot be booked." }, { status: 400 });
    }
    if (handymanProfile?.backgroundCheckStatus !== "PASSED") {
      return NextResponse.json({ error: "This handyman has not passed a background check yet and cannot be booked." }, { status: 400 });
    }

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
      const price = application.proposedPrice ?? jobRequest.budgetMin ?? 0;
      service = await prisma.service.create({
        data: {
          handymanId: application.handymanId,
          title: jobRequest.title,
          description: (jobRequest.description || jobRequest.title).slice(0, 500),
          category: jobRequest.category,
          minPrice: price,
          maxPrice: application.proposedPrice ?? jobRequest.budgetMax ?? price,
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
        totalPrice: application.proposedPrice ?? jobRequest.budgetMin,
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
    await createNotification({
      userId: application.user.id,
      title: "Application Not Selected",
      body: `The customer chose another handyman for "${jobRequest.title}".`,
      type: "booking_request",
      refId: jobRequest.id,
    });
  }

  return NextResponse.json(application);
}
