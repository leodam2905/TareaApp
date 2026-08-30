import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { unmetSteps, unmetStepsMessage } from "@/lib/pro-bookable";
import { syncPayoutStatus } from "@/lib/payout-account";
import { validateMaterials, materialsTier } from "@/lib/materials-policy";
import { credentialBadges, CREDENTIAL_SELECT } from "@/lib/credentials";
import { resolveRate, quoteLabor } from "@/lib/labor-pricing";

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

  // What this pro's labour costs is arithmetic, not a number they type.
  //
  // The customer was shown an interval — "$150-$338 across 7 pros, your price
  // depends on which pro you choose" — built from real rates. If applicants
  // then name arbitrary prices, that interval describes nothing and the
  // comparison the customer is making is between figures with no common basis.
  //
  // So every applicant is quoted on the SAME estimated minutes at their OWN
  // rate: same job, same time, different pro. Their rate for this category
  // wins, then their profile rate, then the platform card (resolveRate).
  const proService = await prisma.service.findFirst({
    where: { handymanId: profile.id, category: jobRequest.category, isActive: true },
    select: { hourlyRate: true, minimumMinutes: true },
  });
  const { hourlyRate } = resolveRate({
    serviceHourlyRate: proService?.hourlyRate,
    profileHourlyRate: profile.hourlyRate,
    category: jobRequest.category,
  });

  const derivedPrice = jobRequest.estimatedBillableMinutes
    ? quoteLabor({
        hourlyRate,
        estimatedBillableMinutes: jobRequest.estimatedBillableMinutes,
        minimumMinutes: proService?.minimumMinutes ?? undefined,
        urgent: jobRequest.urgency === "URGENT",
      }).initialLaborAmount
    : null;

  // A typed price is still honoured when it UNDERCUTS the derived one — a pro
  // discounting themselves is their business. Above it is refused: that is the
  // direction that breaks the customer's comparison and costs them money.
  // Requests predating migration 012 have no minutes, so the typed price stands.
  const typed = proposedPrice != null ? parseFloat(proposedPrice) : null;
  const finalPrice =
    derivedPrice == null
      ? (typed && typed > 0 ? typed : null)
      : typed && typed > 0
        ? Math.min(typed, derivedPrice)
        : derivedPrice;

  const application = await prisma.jobApplication.create({
    data: {
      jobRequestId: params.id,
      handymanId: profile.id,
      userId: user.id,
      message: message?.trim() || null,
      proposedPrice: finalPrice,
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
