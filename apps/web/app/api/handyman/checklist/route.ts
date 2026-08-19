import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPayoutStatus } from "@/lib/payout-account";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let profile = user.handymanProfile;
  if (!profile) {
    profile = await prisma.handymanProfile.create({ data: { userId: user.id, hourlyRate: 50 } });
  }

  // Re-ask Stripe while the payout step still looks outstanding. Nothing else
  // updates the stored status for a pro who onboarded in the app, so without
  // this the ring sticks below 100% for someone who has genuinely finished —
  // and the same flag is what stops them applying for work.
  const [ownServicesCount, availabilityCount, payoutStatus] = await Promise.all([
    prisma.service.count({ where: { handymanId: profile.id } }),
    prisma.handymanAvailability.count({ where: { profileId: profile.id } }),
    user.stripeAccountStatus === "active"
      ? Promise.resolve("active")
      : syncPayoutStatus(user),
  ]);

  const BG_INITIATED = ["PAID", "IN_PROGRESS", "DEFERRED", "PASSED"];

  return NextResponse.json({
    ica:             !!profile.icaSignedAt,
    profile:         !!(user.avatarUrl && profile.bio && profile.idFrontUrl),
    services:        ownServicesCount > 0,
    availability:    availabilityCount > 0,
    backgroundCheck: BG_INITIATED.includes(profile.backgroundCheckStatus as string),
    // Raw status so the app can distinguish "pending review" (paid/deferred)
    // from "complete" (admin-approved = PASSED).
    backgroundCheckStatus: profile.backgroundCheckStatus,
    stripe:          payoutStatus === "active",
  });
}
