import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { profileId: string } }) {
  const photos = await prisma.portfolioPhoto.findMany({
    where: { profileId: params.profileId },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  return NextResponse.json(photos);
}
