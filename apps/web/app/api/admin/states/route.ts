import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

async function seedStates() {
  for (const state of US_STATES) {
    await prisma.activeState.upsert({
      where: { state },
      create: { state, isActive: false },
      update: {},
    });
  }
}

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await seedStates();
  const states = await prisma.activeState.findMany({ orderBy: { state: "asc" } });
  return NextResponse.json(states);
}

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { state, isActive } = await req.json();
  if (!US_STATES.includes(state)) return NextResponse.json({ error: "Invalid state" }, { status: 400 });

  const updated = await prisma.activeState.upsert({
    where: { state },
    create: { state, isActive, activatedAt: isActive ? new Date() : null },
    update: { isActive, activatedAt: isActive ? new Date() : null },
  });

  return NextResponse.json(updated);
}
