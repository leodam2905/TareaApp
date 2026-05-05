import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "No handyman profile" }, { status: 404 });

  const photos = await prisma.portfolioPhoto.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(photos);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "No handyman profile" }, { status: 404 });

  const { url, caption } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const photo = await prisma.portfolioPhoto.create({
    data: { profileId: profile.id, url: url.trim(), caption: caption?.trim() ?? null },
  });

  return NextResponse.json(photo, { status: 201 });
}
