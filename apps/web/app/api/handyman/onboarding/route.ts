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
