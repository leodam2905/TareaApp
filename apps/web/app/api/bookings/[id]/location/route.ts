import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geo/geocode";

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
    select: {
      customerId: true, handymanId: true, isOnMyWay: true,
      handymanLat: true, handymanLng: true, address: true, city: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The destination is only geocoded when asked for. A Booking has an address
  // but no coordinates, and the tracking screen needs them to draw the job pin
  // and work out how far away the pro is. It asks once when the screen opens
  // rather than on every 20s poll, so this stays one geocode per view instead
  // of one per tick.
  let destination: { lat: number; lng: number } | null = null;
  if (req.nextUrl.searchParams.get("destination") === "1") {
    const geo = await geocodeAddress(`${booking.address}, ${booking.city}`, { country: "US" });
    if (geo.coords) destination = geo.coords;
  }

  return NextResponse.json({
    isOnMyWay: booking.isOnMyWay,
    lat: booking.handymanLat,
    lng: booking.handymanLng,
    destination,
  });
}
