import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bio, hourlyRate, yearsExperience, services } = await req.json();

  const profile = await prisma.handymanProfile.upsert({
    where: { userId: user.id },
    update: { bio, hourlyRate: parseFloat(hourlyRate), yearsExperience: parseInt(yearsExperience) },
    create: { userId: user.id, bio, hourlyRate: parseFloat(hourlyRate), yearsExperience: parseInt(yearsExperience) },
  });

  // Delete existing services and recreate with new selections
  await prisma.service.deleteMany({ where: { handymanId: profile.id } });

  if (services?.length) {
    await prisma.service.createMany({
      data: services.map((s: { category: string; title: string; description: string; minPrice: string; maxPrice: string; duration: string }) => ({
        handymanId: profile.id,
        category: s.category,
        title: s.title,
        description: s.description,
        minPrice: parseFloat(s.minPrice),
        maxPrice: parseFloat(s.maxPrice),
        duration: parseInt(s.duration),
        isActive: true,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { idFrontUrl, idBackUrl, licenseNumber, licenseDocUrl, insuranceDocUrl, bio, hourlyRate, yearsExperience } = await req.json();

  // Persist any field the client sends. This is called incrementally during
  // onboarding (e.g. right after each document upload) so partial progress is
  // never lost if the user leaves before finishing the step.
  const data: Record<string, string | number> = {};
  if (idFrontUrl)      data.idFrontUrl      = idFrontUrl;
  if (idBackUrl)       data.idBackUrl       = idBackUrl;
  if (licenseNumber)   data.licenseNumber   = licenseNumber;
  if (licenseDocUrl)   data.licenseDocUrl   = licenseDocUrl;
  if (insuranceDocUrl) data.insuranceDocUrl = insuranceDocUrl;
  if (bio !== undefined && bio !== null)             data.bio             = String(bio);
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "")             data.hourlyRate      = Number(hourlyRate) || 0;
  if (yearsExperience !== undefined && yearsExperience !== null && yearsExperience !== "") data.yearsExperience = Number(yearsExperience) || 0;

  await prisma.handymanProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, hourlyRate: typeof data.hourlyRate === "number" ? data.hourlyRate : 0, ...data },
  });

  return NextResponse.json({ ok: true });
}
