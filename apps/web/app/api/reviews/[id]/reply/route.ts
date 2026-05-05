import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reply } = await req.json();
  if (!reply?.trim()) {
    return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: {
      booking: { select: { handymanId: true } },
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Verify the handyman owns this review's booking
  if (review.booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.review.update({
    where: { id: params.id },
    data: {
      handymanReply: reply.trim(),
      handymanRepliedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
