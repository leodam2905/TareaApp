import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Queries the DB — must run at request time, not be prerendered at build time
// (build-time prerender can't load the Prisma engine / libssl in the Alpine image).
export const dynamic = "force-dynamic";

// Returns available handymen for the customer browse screen. Shape matches what
// the mobile/web browse expects: a flat user object with `handymanProfile` and
// a top-level `services` array, and `id` = the USER id (the detail screen calls
// /users/[id] with it).
export async function GET(_req: NextRequest) {
  const handymen = await prisma.user.findMany({
    where: {
      role: "HANDYMAN",
      isActive: true,
      handymanProfile: { isAvailable: true },
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
          services: {
            where: { isActive: true },
            select: { title: true, category: true },
          },
        },
      },
    },
    orderBy: [
      { handymanProfile: { isPremium: "desc" } },
      { handymanProfile: { rating: "desc" } },
    ],
  });

  const result = handymen.map((h) => ({
    id: h.id,
    name: h.name,
    avatarUrl: h.avatarUrl,
    city: h.city,
    state: h.state,
    latitude: h.latitude,
    longitude: h.longitude,
    isVerified: h.isVerified,
    handymanProfile: h.handymanProfile
      ? {
          bio: h.handymanProfile.bio,
          hourlyRate: h.handymanProfile.hourlyRate,
          rating: h.handymanProfile.rating,
          totalJobs: h.handymanProfile.totalJobs,
          isPremium: h.handymanProfile.isPremium,
        }
      : null,
    services: h.handymanProfile?.services ?? [],
  }));

  return NextResponse.json(result);
}
