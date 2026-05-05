import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const handymen = await prisma.handymanProfile.findMany({
    include: {
      user: { select: { name: true, email: true, isVerified: true, stripeAccountStatus: true } },
    },
    orderBy: { totalEarnings: "desc" },
  });

  return NextResponse.json(handymen);
}
