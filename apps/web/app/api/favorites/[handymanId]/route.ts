import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { handymanId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorite = await prisma.favorite.upsert({
    where: { customerId_handymanId: { customerId: user.id, handymanId: params.handymanId } },
    create: { customerId: user.id, handymanId: params.handymanId },
    update: {},
  });

  return NextResponse.json(favorite, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { handymanId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.favorite.deleteMany({
    where: { customerId: user.id, handymanId: params.handymanId },
  });

  return NextResponse.json({ ok: true });
}
