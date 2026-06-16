import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const handymen = await prisma.handymanProfile.findMany({
    include: {
      user: {
        select: {
          name: true, email: true, avatarUrl: true,
          isVerified: true, stripeAccountStatus: true,
        },
      },
      services: { select: { id: true } },
      availability: { select: { id: true } },
    },
    orderBy: { totalEarnings: "desc" },
  });

  const BG_INITIATED = ["PAID", "IN_PROGRESS", "DEFERRED", "PASSED"];

  const result = handymen.map(h => ({
    id: h.id,
    rating: h.rating,
    totalJobs: h.totalJobs,
    totalEarnings: h.totalEarnings,
    backgroundCheckStatus: h.backgroundCheckStatus,
    verificationStatus: h.verificationStatus,
    isPremium: h.isPremium,
    idFrontUrl: h.idFrontUrl,
    idBackUrl: h.idBackUrl,
    licenseNumber: h.licenseNumber,
    licenseDocUrl: h.licenseDocUrl,
    insuranceDocUrl: h.insuranceDocUrl,
    icaSignedAt: h.icaSignedAt,
    icaSignedIp: h.icaSignedIp,
    user: h.user,
    checklist: {
      ica:             !!h.icaSignedAt,
      profile:         !!(h.user.avatarUrl && h.bio && h.idFrontUrl),
      services:        h.services.length > 0,
      availability:    h.availability.length > 0,
      backgroundCheck: BG_INITIATED.includes(h.backgroundCheckStatus as string),
      stripe:          h.user.stripeAccountStatus === "active",
    },
  }));

  return NextResponse.json(result);
}

const VALID_BG_STATUSES = ["PENDING", "DEFERRED", "PAID", "IN_PROGRESS", "PASSED", "FAILED"];

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { profileId, backgroundCheckStatus } = await req.json();
  if (!profileId || !VALID_BG_STATUSES.includes(backgroundCheckStatus)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await prisma.handymanProfile.update({
    where: { id: profileId },
    data: { backgroundCheckStatus },
  });

  return NextResponse.json({ ok: true });
}
