import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, clearAuthCookie } from "@/lib/auth";

// Uses auth cookies — must run at request time, never prerendered.
export const dynamic = "force-dynamic";

// Self-service account deletion (App Store Guideline 5.1.1 requirement).
// Removes all personally identifiable information and disables login. Anonymized
// booking/payment records are retained only as required for tax/legal purposes.
export async function DELETE(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const anonEmail = `deleted-${user.id}@deleted.taptarea.com`;
  const deadHash = await hashPassword(randomUUID()); // random secret → login impossible

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: anonEmail,
        name: "Deleted User",
        phone: null,
        avatarUrl: null,
        companyName: null,
        companyLogoUrl: null,
        passwordHash: deadHash,
        isActive: false,
        referralCode: null,
        expoPushToken: null,
        fcmToken: null,
        latitude: null,
        longitude: null,
      },
    });

    // Stop all push delivery to a deleted account's devices.
    await tx.deviceToken.deleteMany({ where: { userId: user.id } });

    // Clear sensitive Pro documents/profile info if this is a handyman.
    if (user.role === "HANDYMAN") {
      await tx.handymanProfile.updateMany({
        where: { userId: user.id },
        data: {
          verificationDocUrl: null,
          idFrontUrl: null,
          idBackUrl: null,
          licenseDocUrl: null,
          insuranceDocUrl: null,
          bio: null,
          isAvailable: false,
        },
      });
    }
  });

  clearAuthCookie();
  return NextResponse.json({ success: true });
}
