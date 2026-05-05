import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "No handyman profile" }, { status: 404 });

  const photo = await prisma.portfolioPhoto.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (photo.profileId !== profile.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.portfolioPhoto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
