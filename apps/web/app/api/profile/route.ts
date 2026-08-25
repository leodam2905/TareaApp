import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { credentialBadges, credentialViews } from "@/lib/credentials";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    include: { handymanProfile: { include: { services: true, availability: true } } },
  });

  if (!profile?.handymanProfile) return NextResponse.json(profile);

  // Licence and insurance carry a decision and an expiry, neither of which is
  // readable from the raw columns — `licenseStatus: "approved"` on a document
  // that lapsed last week is still not a licence. The clients read `badges`
  // rather than deriving it, so expiry is applied in exactly one place.
  const hp = profile.handymanProfile;
  return NextResponse.json({
    ...profile,
    handymanProfile: {
      ...hp,
      credentials: credentialViews(hp),
      badges: credentialBadges(hp),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, address, city, state, zipCode, latitude, longitude, avatarUrl, bio, hourlyRate, isAvailable, serviceRadius, companyName, companyLogoUrl, ein, website } = body;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zipCode !== undefined && { zipCode }),
      ...(latitude !== undefined && latitude !== null && latitude !== "" && { latitude: parseFloat(latitude) }),
      ...(longitude !== undefined && longitude !== null && longitude !== "" && { longitude: parseFloat(longitude) }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(companyName !== undefined && { companyName }),
      ...(companyLogoUrl !== undefined && { companyLogoUrl }),
      ...(ein !== undefined && { ein }),
      ...(website !== undefined && { website }),
    },
  });

  if (user.role === "HANDYMAN" && (bio !== undefined || hourlyRate !== undefined || isAvailable !== undefined || serviceRadius !== undefined)) {
    await prisma.handymanProfile.updateMany({
      where: { userId: user.id },
      data: {
        ...(bio !== undefined && { bio }),
        ...(hourlyRate !== undefined && { hourlyRate: parseFloat(hourlyRate) }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(serviceRadius !== undefined && { serviceRadius: parseInt(serviceRadius) }),
      },
    });
  }

  return NextResponse.json(updated);
}
