import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; appId: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobRequest = await prisma.jobRequest.findUnique({
    where: { id: params.id },
    include: { applications: true },
  });
  if (!jobRequest || jobRequest.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { action } = await req.json();

  const application = await prisma.jobApplication.update({
    where: { id: params.appId },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
    include: { handyman: { include: { user: true } }, user: true },
  });

  if (action === "accept") {
    await prisma.jobRequest.update({ where: { id: params.id }, data: { status: "ASSIGNED" } });
    await prisma.jobApplication.updateMany({
      where: { jobRequestId: params.id, id: { not: params.appId } },
      data: { status: "REJECTED" },
    });

    const service = await prisma.service.findFirst({
      where: { handymanId: application.handymanId, category: jobRequest.category, isActive: true },
    });

    if (service) {
      await prisma.booking.create({
        data: {
          customerId: user.id,
          handymanId: application.user.id,
          serviceId: service.id,
          scheduledAt: jobRequest.scheduledAt,
          address: jobRequest.address,
          city: jobRequest.city,
          totalPrice: application.proposedPrice ?? jobRequest.budgetMin,
          materialsEstimate: application.materialsEstimate ?? 0,
          responseDeadline: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    }

    await createNotification({
      userId: application.user.id,
      title: "Application Accepted!",
      body: `You got the job: "${jobRequest.title}". Check your Jobs tab.`,
      type: "booking_accepted",
      refId: jobRequest.id,
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
