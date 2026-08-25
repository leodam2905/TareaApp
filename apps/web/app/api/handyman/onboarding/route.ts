import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Fields that describe a document rather than the profile itself.
 *
 * Both POST and PATCH accept these. They used to be PATCH-only while the
 * Flutter certifications screen POSTed them, so every licence and insurance
 * upload from that screen was accepted with `{ok: true}` and thrown away — the
 * pro saw "document submitted" for a file that was never stored.
 *
 * A new licence or insurance document also resets that credential to
 * `pending`: a replacement is a document no admin has seen. The stale review
 * note goes with it, since it describes the file that was just replaced.
 * Government ID is not part of this — it is the identity decision, tracked by
 * `verificationStatus`.
 */
async function docFields(userId: string, body: Record<string, unknown>) {
  const { idFrontUrl, idBackUrl, licenseNumber, licenseDocUrl, insuranceDocUrl } = body;

  // Government ID can be set ONCE. Once on file it's locked — only an admin can
  // change it. So we only accept idFront/idBack if they're not already set.
  const existing = await prisma.handymanProfile.findUnique({
    where: { userId }, select: { idFrontUrl: true, idBackUrl: true },
  });

  const data: Record<string, unknown> = {};
  if (idFrontUrl && !existing?.idFrontUrl) data.idFrontUrl = String(idFrontUrl);
  if (idBackUrl  && !existing?.idBackUrl)  data.idBackUrl  = String(idBackUrl);
  if (licenseNumber) data.licenseNumber = String(licenseNumber);

  if (licenseDocUrl) {
    data.licenseDocUrl = String(licenseDocUrl);
    data.licenseStatus = "pending";
    data.licenseReviewedAt = null;
    data.licenseReviewNote = null;
  }
  if (insuranceDocUrl) {
    data.insuranceDocUrl = String(insuranceDocUrl);
    data.insuranceStatus = "pending";
    data.insuranceReviewedAt = null;
    data.insuranceReviewNote = null;
  }

  return data;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { bio, hourlyRate, yearsExperience, services } = body;

  // Only update the fields actually provided — never blank out existing data
  // on a partial/empty save (that was wiping onboarding progress).
  const update: Record<string, unknown> = { ...(await docFields(user.id, body)) };
  if (bio !== undefined && bio !== null && bio !== "") update.bio = String(bio);
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") update.hourlyRate = parseFloat(hourlyRate) || 0;
  if (yearsExperience !== undefined && yearsExperience !== null && yearsExperience !== "") update.yearsExperience = parseInt(yearsExperience) || 0;

  const profile = await prisma.handymanProfile.upsert({
    where: { userId: user.id },
    update,
    create: { userId: user.id, ...update, hourlyRate: typeof update.hourlyRate === "number" ? update.hourlyRate : 0 },
  });

  // Only replace services when a non-empty list is provided. Never delete on an
  // empty/absent list — that was erasing previously-saved services.
  if (Array.isArray(services) && services.length > 0) {
    await prisma.service.deleteMany({ where: { handymanId: profile.id } });
    await prisma.service.createMany({
      data: services.map((s: { category: string; title: string; description: string; minPrice: string; maxPrice: string; duration: string }) => ({
        handymanId: profile.id,
        category: s.category,
        title: s.title,
        description: s.description,
        minPrice: parseFloat(s.minPrice),
        maxPrice: parseFloat(s.maxPrice),
        duration: parseInt(s.duration),
        isActive: true,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { bio, hourlyRate, yearsExperience } = body;

  // Persist any field the client sends. This is called incrementally during
  // onboarding (e.g. right after each document upload) so partial progress is
  // never lost if the user leaves before finishing the step.
  const data: Record<string, unknown> = { ...(await docFields(user.id, body)) };
  if (bio !== undefined && bio !== null)             data.bio             = String(bio);
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "")             data.hourlyRate      = Number(hourlyRate) || 0;
  if (yearsExperience !== undefined && yearsExperience !== null && yearsExperience !== "") data.yearsExperience = Number(yearsExperience) || 0;

  await prisma.handymanProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data, hourlyRate: typeof data.hourlyRate === "number" ? data.hourlyRate : 0 },
  });

  return NextResponse.json({ ok: true });
}
