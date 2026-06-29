import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateProxySession } from "@/lib/voice";

// POST /api/bookings/[id]/call
// Returns the proxy number this user should dial to reach the other party on
// the booking. The app opens the native dialer with this number; Telnyx bridges
// the call so neither side sees the other's real number.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { id: true, customerId: true, handymanId: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the two parties on the booking may open a call channel.
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Don't keep contact open indefinitely after the engagement ends.
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    return NextResponse.json({ error: "Calling is closed for this booking" }, { status: 409 });
  }

  if (!user.phone) {
    return NextResponse.json(
      { error: "Add a phone number to your profile to make calls" },
      { status: 422 }
    );
  }

  const session = await getOrCreateProxySession(booking.id);
  if (!session) {
    // Either the other party has no phone on file, or the proxy pool is empty.
    return NextResponse.json({ error: "Calling is unavailable right now" }, { status: 503 });
  }

  return NextResponse.json({
    proxyNumber: session.proxyNumber,
    expiresAt: session.expiresAt,
  });
}
