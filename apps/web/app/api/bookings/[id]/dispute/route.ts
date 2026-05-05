import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reason } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "Reason required" }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["IN_PROGRESS", "COMPLETED"].includes(booking.status)) {
    return NextResponse.json({ error: "Can only dispute active or completed bookings" }, { status: 400 });
  }
  if (booking.status === "DISPUTED") {
    return NextResponse.json({ error: "Already disputed" }, { status: 400 });
  }

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: {
      status: "DISPUTED",
      disputeReason: reason.trim(),
      disputedBy: user.id,
      disputedAt: new Date(),
    },
  });

  // Notify the other party
  const otherUserId = user.id === booking.customerId ? booking.handymanId : booking.customerId;
  await createNotification({
    userId: otherUserId,
    title: "Booking disputed",
    body: `A dispute was filed for your booking. Our team will review it shortly.`,
    type: "booking_cancelled",
    refId: booking.id,
  });

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  await Promise.all(admins.map(a => createNotification({
    userId: a.id,
    title: "New dispute filed",
    body: `Booking #${booking.id.slice(-8).toUpperCase()} has been disputed.`,
    type: "booking_cancelled",
    refId: booking.id,
  })));

  return NextResponse.json(updated);
}
