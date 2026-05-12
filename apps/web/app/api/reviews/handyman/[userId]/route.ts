import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const reviews = await prisma.review.findMany({
    where: { receiverId: params.userId },
    include: { author: { select: { name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(reviews);
}
