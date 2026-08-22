import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { responseDeadlineFromNow } from "@/lib/booking-deadlines";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { service: { select: { title: true } }, handyman: { select: { name: true } } },
  });

  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (original.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { scheduledAt } = await req.json();
  if (!scheduledAt) return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });

  const responseDeadline = responseDeadlineFromNow(); // 2 hours for the pro to accept

  const newBooking = await prisma.booking.create({
    data: {
      customerId: original.customerId,
      handymanId: original.handymanId,
      serviceId: original.serviceId,
      address: original.address,
      city: original.city,
      notes: original.notes,
      totalPrice: original.totalPrice,
      scheduledAt: new Date(scheduledAt),
      responseDeadline,
      status: "PENDING",
    },
  });

  await createNotification({
    userId: original.handymanId,
    title: "New booking request",
    body: `${user.name} booked ${original.service.title} again for ${new Date(scheduledAt).toLocaleDateString()}.`,
    type: "booking_request",
    refId: newBooking.id,
  });

  return NextResponse.json(newBooking, { status: 201 });
}
