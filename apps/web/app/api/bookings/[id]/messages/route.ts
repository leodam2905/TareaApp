import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/app/api/sse/route";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { bookingId: params.id },
    include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Mark unread as read for the current user
  await prisma.message.updateMany({
    where: { bookingId: params.id, isRead: false, NOT: { senderId: user.id } },
    data: { isRead: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A finished engagement is finished. Calls already stop at completion
  // (canCall returns false for COMPLETED and CANCELLED); messages did not, so
  // the two halves of the same conversation had different rules. Reading the
  // history stays allowed — it is the record of a job somebody paid for, and
  // the evidence in a dispute.
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    return NextResponse.json(
      { error: "This job is closed. Messaging is no longer available — contact support@taptarea.com if you need help." },
      { status: 409 },
    );
  }
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const message = await prisma.message.create({
    data: { bookingId: params.id, senderId: user.id, content: content.trim() },
    include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });

  const notifyId = user.id === booking.customerId ? booking.handymanId : booking.customerId;

  // Push real-time SSE event to the other user
  notifyUser(notifyId, { type: "chat_message", data: { bookingId: params.id, message } });

  await createNotification({
    userId: notifyId,
    title: "New message",
    body: `${user.name}: ${content.trim().slice(0, 60)}`,
    // Its own type, so a client can open the CHAT rather than the booking.
    // It used to share "booking_request" with job phases and new-service
    // announcements, which is why a customer tapping "New message" got nothing:
    // the app had no safe destination for a type that meant three things.
    type: "chat_message",
    refId: params.id,
  });

  return NextResponse.json(message, { status: 201 });
}
