import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const jobRequest = await prisma.jobRequest.findUnique({ where: { id: params.id } });
  if (!jobRequest || jobRequest.status !== "OPEN") {
    return NextResponse.json({ error: "Job not available" }, { status: 400 });
  }
  // A dual-role account can't apply to a job it posted itself.
  if (jobRequest.customerId === user.id) {
    return NextResponse.json({ error: "You can't apply to your own job request." }, { status: 400 });
  }

  // A pro with no profile photo cannot be booked — the hire endpoint refuses
  // it. Letting them apply anyway pushes that refusal onto the customer, who
  // picks somebody, gets an error and has to choose again. Refuse here so the
  // person who can fix it is the one who hears about it.
  if (!user.avatarUrl) {
    return NextResponse.json(
      { error: "Add a profile photo before applying — customers cannot book a Pro without one." },
      { status: 400 },
    );
  }

  const { message, proposedPrice, materialsEstimate } = await req.json();

  const application = await prisma.jobApplication.create({
    data: {
      jobRequestId: params.id,
      handymanId: profile.id,
      userId: user.id,
      message: message?.trim() || null,
      proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null,
      materialsEstimate: materialsEstimate ? parseFloat(materialsEstimate) : null,
    },
  });

  await createNotification({
    userId: jobRequest.customerId,
    title: "New Application Received",
    body: `${user.name} applied to your job: "${jobRequest.title}". Review it in My Requests.`,
    type: "booking_request",
    refId: jobRequest.id,
  });

  return NextResponse.json(application, { status: 201 });
}
