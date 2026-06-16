import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string; phaseId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customerId !== user.id) {
    return NextResponse.json({ error: "Only the customer can confirm phases" }, { status: 403 });
  }

  // Ensure the phase actually belongs to this booking (prevents confirming a
  // phase on an unrelated booking by passing a foreign phaseId).
  const existingPhase = await prisma.bookingPhase.findUnique({ where: { id: params.phaseId } });
  if (!existingPhase || existingPhase.bookingId !== params.id) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  const phase = await prisma.bookingPhase.update({
    where: { id: params.phaseId },
    data: { confirmedAt: new Date() },
  });

  await createNotification({
    userId: booking.handymanId,
    title: "Phase Confirmed ✓",
    body: `Customer confirmed: "${phase.title}". You can proceed to the next step.`,
    type: "booking_accepted",
    refId: booking.id,
  });

  return NextResponse.json(phase);
}
