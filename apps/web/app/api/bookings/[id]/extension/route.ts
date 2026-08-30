import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { quoteExtraTime, resolveRate, formatMinutes } from "@/lib/labor-pricing";

// POST — handyman requests a time extension
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true, handymanId: true, customerId: true, status: true,
      proRateSnapshot: true,
      service: { select: { title: true, category: true, hourlyRate: true } },
      extensions: { where: { status: "PENDING" } },
    },
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
  const reason = body.reason?.trim() || null;

  if (!additionalMinutes || additionalMinutes <= 0) {
    return NextResponse.json({ error: "additionalMinutes must be a positive number" }, { status: 400 });
  }

  // What extra time costs is arithmetic, not a number the pro types.
  //
  // The amount used to arrive from the client, so a pro could ask for fifteen
  // more minutes at any price they liked and the customer would see only the
  // total. It is now the rate this booking was priced at, times the minutes —
  // no travel and no call-out minimum, because the pro is already on site.
  //
  // A pro undercutting their own rate is still allowed; a pro exceeding it is
  // not, which is the direction that costs the customer.
  const rate = booking.proRateSnapshot
    ?? resolveRate({
         serviceHourlyRate: booking.service?.hourlyRate,
         category: booking.service?.category,
       }).hourlyRate;

  const derived = quoteExtraTime({ hourlyRate: rate, additionalMinutes });
  const requested = body.extraAmount != null ? parseFloat(body.extraAmount) : null;
  if (requested != null && (isNaN(requested) || requested < 0)) {
    return NextResponse.json({ error: "extraAmount must be zero or positive" }, { status: 400 });
  }
  const extraAmount = requested != null ? Math.min(requested, derived) : derived;

  const extension = await prisma.bookingExtension.create({
    data: { bookingId: params.id, additionalMinutes, extraAmount, reason },
  });

  const timeLabel = formatMinutes(additionalMinutes);
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
