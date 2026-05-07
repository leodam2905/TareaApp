import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const states = await prisma.activeState.findMany({
    where: { isActive: true },
    select: { state: true },
  });
  return NextResponse.json(states.map((s) => s.state));
}
