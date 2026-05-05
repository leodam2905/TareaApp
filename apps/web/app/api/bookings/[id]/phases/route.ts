import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phases = await prisma.bookingPhase.findMany({
    where: { bookingId: params.id },
    orderBy: { startedAt: "asc" },
  });

  return NextResponse.json(phases);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Only the handyman can start phases" }, { status: 403 });
  }

  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Phase title is required" }, { status: 400 });

  const phase = await prisma.bookingPhase.create({
    data: { bookingId: params.id, title: title.trim() },
  });

  await createNotification({
    userId: booking.customerId,
    title: "New Job Phase Started",
    body: `Your handyman started: "${title.trim()}". Open your bookings to confirm when ready.`,
    type: "booking_request",
    refId: booking.id,
  });

  return NextResponse.json(phase, { status: 201 });
}
