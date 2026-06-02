import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const handymen = await prisma.user.findMany({
    where: {
      role: "HANDYMAN",
      handymanProfile: { isNot: null },
      ...(category ? { services: { some: { category: category as any, isActive: true } } } : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      isVerified: true,
      handymanProfile: {
        select: {
          bio: true,
          hourlyRate: true,
          rating: true,
          totalJobs: true,
          isPremium: true,
        },
      },
      services: {
        where: { isActive: true },
        select: { title: true, category: true },
        take: 5,
      },
    },
    take: 50,
    orderBy: { handymanProfile: { rating: "desc" } },
  });

  return NextResponse.json(handymen);
}
