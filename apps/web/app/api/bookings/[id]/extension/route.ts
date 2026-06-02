import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// POST — handyman requests a time extension
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { id: true, handymanId: true, customerId: true, status: true, service: { select: { title: true } }, extensions: { where: { status: "PENDING" } } },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.handymanId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["ACCEPTED", "IN_PROGRESS"].includes(booking.status)) {
    return NextResponse.json({ error: "Extensions can only be requested for active bookings" }, { status: 400 });
  }
  if (booking.extensions.length > 0) {
    return NextResponse.json({ error: "A time extension request is already pending" }, { status: 400 });
  }

  const body = await req.json();
  const additionalMinutes = parseInt(body.additionalMinutes);
  const extraAmount = body.extraAmount ? parseFloat(body.extraAmount) : 0;
  const reason = body.reason?.trim() || null;

  if (!additionalMinutes || additionalMinutes <= 0) {
    return NextResponse.json({ error: "additionalMinutes must be a positive number" }, { status: 400 });
  }
  if (isNaN(extraAmount) || extraAmount < 0) {
    return NextResponse.json({ error: "extraAmount must be zero or positive" }, { status: 400 });
  }

  const extension = await prisma.bookingExtension.create({
    data: { bookingId: params.id, additionalMinutes, extraAmount, reason },
  });

  const hours = Math.floor(additionalMinutes / 60);
  const mins = additionalMinutes % 60;
  const timeLabel = hours > 0
    ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}`
    : `${mins}m`;
  const extraLabel = extraAmount > 0 ? ` (+$${extraAmount.toFixed(2)})` : "";

  await createNotification({
    userId: booking.customerId,
    title: "Handyman needs more time ⏱",
    body: `Your handyman requested ${timeLabel} more to complete "${booking.service.title}"${extraLabel}. Open the booking to approve or decline.`,
    type: "booking_accepted",
    refId: booking.id,
  });

  return NextResponse.json(extension, { status: 201 });
}
