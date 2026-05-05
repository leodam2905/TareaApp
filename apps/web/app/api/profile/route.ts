import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    include: { handymanProfile: { include: { services: true, availability: true } } },
  });

  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, address, city, state, zipCode, avatarUrl, bio, hourlyRate, isAvailable, serviceRadius } = body;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zipCode !== undefined && { zipCode }),
      ...(avatarUrl !== undefined && { avatarUrl }),
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
