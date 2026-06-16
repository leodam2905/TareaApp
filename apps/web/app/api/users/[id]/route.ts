import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    // NOTE: this is a public profile projection — do NOT include email/phone or
    // other PII, to prevent enumeration/harvesting of contact details.
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
      state: true,
      handymanProfile: {
        select: {
          id: true,
          bio: true,
          rating: true,
          totalJobs: true,
          hourlyRate: true,
          yearsExperience: true,
          responseTime: true,
          backgroundCheckStatus: true,
          services: {
            where: { isActive: true },
            select: { id: true, title: true, category: true, minPrice: true, maxPrice: true, duration: true },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
