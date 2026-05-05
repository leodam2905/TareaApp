import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { customerId: user.id },
    include: {
      handyman: {
        select: {
          id: true,
          bio: true,
          rating: true,
          totalJobs: true,
          hourlyRate: true,
          isPremium: true,
          user: { select: { id: true, name: true, avatarUrl: true, city: true, isVerified: true } },
          services: {
            where: { isActive: true },
            select: { id: true, title: true, category: true, minPrice: true, maxPrice: true },
            take: 3,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}
