import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json([]);

  const availability = await prisma.handymanAvailability.findMany({
    where: { profileId: profile.id },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json(availability);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // slots: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
  const { slots } = await req.json();

  // Only replace availability when a non-empty list is provided. Never delete on
  // an empty/absent list — that was erasing previously-saved availability.
  if (Array.isArray(slots) && slots.length > 0) {
    await prisma.handymanAvailability.deleteMany({ where: { profileId: profile.id } });
    await prisma.handymanAvailability.createMany({
      data: slots.map((s: { dayOfWeek: number; startHour: number; endHour: number }) => ({
        profileId: profile.id,
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        endHour: s.endHour,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
