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
    // Record WHICH text was accepted, not just when. Without this a later
    // version bump silently rewrites what every existing pro agreed to.
    data: { icaSignedAt: new Date(), icaSignedIp: ip, icaSignedVersion: AGREEMENT_VERSION },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: { icaSignedAt: true, icaSignedVersion: true },
  });

  // The agreement itself ships with the response so the mobile app renders the
  // same text the web does, from the same source. Without this the app had no
  // copy of the contract and the agreement step could not be built at all.
  return NextResponse.json({
    signed: !!profile?.icaSignedAt,
    signedAt: profile?.icaSignedAt ?? null,
    signedVersion: profile?.icaSignedVersion ?? null,
    // True when the pro accepted a text older than the one being served, so a
    // re-acceptance can be asked for. Null signedVersion counts as outdated:
    // it means they signed before versions were recorded.
    outdated: !!profile?.icaSignedAt && profile.icaSignedVersion !== AGREEMENT_VERSION,
    version: AGREEMENT_VERSION,
    document: ICA,
  });
}
