import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unmetSteps, unmetStepsMessage } from "@/lib/pro-bookable";
import { syncPayoutStatus } from "@/lib/payout-account";
import { validateMaterials, materialsTier } from "@/lib/materials-policy";
import { credentialBadges, CREDENTIAL_SELECT } from "@/lib/credentials";

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

  // Only a bookable pro may apply: all six onboarding steps complete.
  //
  // Letting an unfinished pro apply pushes the refusal onto the customer, who
  // picks somebody and is told no at the last step. Refusing here puts it in
  // front of the person who can actually fix it, and names what is missing —
  // "you cannot apply" is useless to someone who does not know which of six
  // things to go and do.
  // Ask Stripe before refusing on payouts. The stored status is only written
  // when something syncs it, and for a pro who onboarded through the app
  // nothing ever did — so a finished payout account still read "pending" and
  // this endpoint refused work the pro was perfectly entitled to take.
  const [servicesCount, availabilityCount, payoutStatus] = await Promise.all([
    prisma.service.count({ where: { handymanId: profile.id } }),
    prisma.handymanAvailability.count({ where: { profileId: profile.id } }),
    user.stripeAccountStatus === "active"
      ? Promise.resolve("active")
      : syncPayoutStatus(user),
  ]);
  const missing = unmetSteps({
    avatarUrl: user.avatarUrl,
    stripeAccountStatus: payoutStatus,
    profile: {
      icaSignedAt: profile.icaSignedAt,
      bio: profile.bio,
      idFrontUrl: profile.idFrontUrl,
      backgroundCheckStatus: profile.backgroundCheckStatus as string,
      servicesCount,
      availabilityCount,
    },
  });
  if (missing.length > 0) {
    return NextResponse.json({ error: unmetStepsMessage(missing), missing }, { status: 400 });
  }

  const { message, proposedPrice, materialsEstimate } = await req.json();

  // The materials tier is checked HERE, not only on the browse list. A pro can
  // reach this route with a job id they were shown before their credentials
  // lapsed, or straight from the API — and this is the point where a number the
  // customer will be charged actually enters the system.
  const materials = validateMaterials(materialsEstimate);
  if (!materials.ok) return NextResponse.json({ error: materials.error }, { status: 400 });

  if (materialsTier(materials.value) === "licensed_only") {
    const docs = await prisma.handymanProfile.findUnique({
      where: { id: profile.id }, select: CREDENTIAL_SELECT,
    });
    const badges = docs ? credentialBadges(docs) : { licensed: false, insured: false };
    if (!badges.licensed || !badges.insured) {
      return NextResponse.json({
        error: "Quotes over $300 in materials are open to Licensed & Insured pros only. "
             + "Add an approved licence and insurance certificate, or quote materials at $300 or under.",
      }, { status: 403 });
    }
  }

  const application = await prisma.jobApplication.create({
    data: {
      jobRequestId: params.id,
      handymanId: profile.id,
      userId: user.id,
      message: message?.trim() || null,
      proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null,
      materialsEstimate: materials.value || null,
    },
  });

  await createNotification({
    userId: jobRequest.customerId,
    title: "New Application Received",
    body: `${user.name} applied to your job: "${jobRequest.title}". Review it in My Requests.`,
    // NOT booking_request: refId is a jobRequest id, and the app sends a
    // customer's booking_request to /booking-detail, which then fetches
    // /bookings/{jobRequestId} and 404s. The tap looked broken because it
    // opened a dead screen. job_application routes to My Requests, which is
    // where this notification tells them to go anyway.
    type: "job_application",
    refId: jobRequest.id,
  });

  return NextResponse.json(application, { status: 201 });
}
