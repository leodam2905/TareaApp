import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notifBookingUpdates: true, notifReminders: true, notifMessages: true, notifSms: true },
  });

  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, boolean> = {};
  if (typeof body.notifBookingUpdates === "boolean") data.notifBookingUpdates = body.notifBookingUpdates;
  if (typeof body.notifReminders === "boolean") data.notifReminders = body.notifReminders;
  if (typeof body.notifMessages === "boolean") data.notifMessages = body.notifMessages;
  if (typeof body.notifSms === "boolean") data.notifSms = body.notifSms;

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({
    notifBookingUpdates: updated.notifBookingUpdates,
    notifReminders: updated.notifReminders,
    notifMessages: updated.notifMessages,
    notifSms: updated.notifSms,
  });
}
