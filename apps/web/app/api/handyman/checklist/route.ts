import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let profile = user.handymanProfile;
  if (!profile) {
    profile = await prisma.handymanProfile.create({ data: { userId: user.id, hourlyRate: 50 } });
  }

  const [ownServicesCount, availabilityCount] = await Promise.all([
    prisma.service.count({ where: { handymanId: profile.id } }),
    prisma.handymanAvailability.count({ where: { profileId: profile.id } }),
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
    stripe:          user.stripeAccountStatus === "active",
  });
}
