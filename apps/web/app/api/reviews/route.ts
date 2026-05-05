import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  bookingId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = schema.parse(await req.json());

    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking || booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Can only review completed bookings" }, { status: 400 });
    }
    if (booking.customerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const review = await prisma.review.create({
      data: {
        bookingId: data.bookingId,
        authorId: user.id,
        receiverId: booking.handymanId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    // Update handyman average rating
    const allReviews = await prisma.review.findMany({
      where: { receiverId: booking.handymanId },
    });
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;

    await prisma.handymanProfile.updateMany({
      where: { userId: booking.handymanId },
      data: { rating: avg, totalJobs: { increment: 1 } },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
