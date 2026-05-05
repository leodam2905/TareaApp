import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.handymanId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lat, lng, isOnMyWay } = await req.json();

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: {
      ...(lat !== undefined && { handymanLat: lat }),
      ...(lng !== undefined && { handymanLng: lng }),
      ...(isOnMyWay !== undefined && { isOnMyWay }),
    },
  });

  if (isOnMyWay === true) {
    await createNotification({
      userId: booking.customerId,
      title: "Handyman is on the way!",
      body: "Your handyman has started heading to your location.",
      type: "booking_accepted",
      refId: booking.id,
    });
  }

  return NextResponse.json({ ok: true, isOnMyWay: updated.isOnMyWay });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { customerId: true, handymanId: true, isOnMyWay: true, handymanLat: true, handymanLng: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    isOnMyWay: booking.isOnMyWay,
    lat: booking.handymanLat,
    lng: booking.handymanLng,
  });
}
