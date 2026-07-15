import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST — upgrade the current account so it can also work as a Pro.
// Hiring/booking stays available to everyone, so this is purely additive:
// the same account can now both hire (in the Home app) and work (in the Pro app).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.$transaction(async (tx) => {
    if (user.role !== "HANDYMAN") {
      await tx.user.update({ where: { id: user.id }, data: { role: "HANDYMAN" } });
    }
    await tx.handymanProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, hourlyRate: 0 },
    });
  });

  return NextResponse.json({ ok: true, role: "HANDYMAN" });
}
