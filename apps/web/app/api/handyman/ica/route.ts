import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ICA, AGREEMENT_VERSION } from "@/lib/ica-text";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown";

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  await prisma.handymanProfile.update({
    where: { userId: user.id },
    data: { icaSignedAt: new Date(), icaSignedIp: ip },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: { icaSignedAt: true },
  });

  // The agreement itself ships with the response so the mobile app renders the
  // same text the web does, from the same source. Without this the app had no
  // copy of the contract and the agreement step could not be built at all.
  return NextResponse.json({
    signed: !!profile?.icaSignedAt,
    signedAt: profile?.icaSignedAt ?? null,
    version: AGREEMENT_VERSION,
    document: ICA,
  });
}
