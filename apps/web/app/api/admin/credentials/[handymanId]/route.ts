import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import {
  CREDENTIAL_KINDS,
  CREDENTIAL_SELECT,
  CredentialKind,
  credentialViews,
  parseExpiry,
} from "@/lib/credentials";

/** One pro's credentials, for the review screen. */
export async function GET(_req: NextRequest, { params }: { params: { handymanId: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.handymanProfile.findUnique({
    where: { id: params.handymanId },
    select: CREDENTIAL_SELECT,
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(credentialViews(profile));
}

const LABEL: Record<CredentialKind, string> = { license: "License", insurance: "Insurance" };

/**
 * Approve or reject ONE credential.
 *
 * Deliberately separate from /api/admin/verification/[handymanId], which is the
 * identity decision — that one also flips `user.isVerified` and the background
 * check. A licence says nothing about who someone is, so approving one here
 * grants the Licensed badge and nothing else.
 *
 * An approval may carry `expiresAt`: the expiry usually comes off the document
 * itself, which the admin is looking at and the pro may not have typed in.
 */
export async function PATCH(req: NextRequest, { params }: { params: { handymanId: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "") as CredentialKind;
  if (!CREDENTIAL_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${CREDENTIAL_KINDS.join(", ")}` }, { status: 400 });
  }

  const decision = String(body.decision ?? "");
  if (!["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  // A rejection the pro cannot act on just produces a resubmission of the same
  // document, so the reason is required rather than optional.
  if (decision === "reject" && !note) {
    return NextResponse.json({ error: "note is required when rejecting — the pro is shown this reason" }, { status: 400 });
  }

  const expiry = parseExpiry(body.expiresAt);
  if (!expiry.ok) return NextResponse.json({ error: expiry.error }, { status: 400 });

  const profile = await prisma.handymanProfile.findUnique({
    where: { id: params.handymanId },
    select: { userId: true, licenseDocUrl: true, insuranceDocUrl: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Nothing to decide on if the pro never submitted anything — otherwise an
  // approval would grant a badge backed by no document at all.
  const docUrl = kind === "license" ? profile.licenseDocUrl : profile.insuranceDocUrl;
  if (!docUrl) {
    return NextResponse.json({ error: `No ${kind} document on file for this pro` }, { status: 409 });
  }

  const status = decision === "approve" ? "approved" : "rejected";
  const data: Record<string, unknown> =
    kind === "license"
      ? { licenseStatus: status, licenseReviewedAt: new Date(), licenseReviewNote: note || null }
      : { insuranceStatus: status, insuranceReviewedAt: new Date(), insuranceReviewNote: note || null };

  if (!expiry.absent) {
    data[kind === "license" ? "licenseExpiresAt" : "insuranceExpiresAt"] = expiry.value;
  }

  const updated = await prisma.handymanProfile.update({
    where: { id: params.handymanId },
    data,
    select: CREDENTIAL_SELECT,
  });

  const views = credentialViews(updated);
  const view = views[kind];

  await createNotification({
    userId: profile.userId,
    title: decision === "approve" ? `${LABEL[kind]} verified ✓` : `${LABEL[kind]} not accepted`,
    body: decision === "approve"
      ? view.expiresAt
        ? `Your ${kind} is verified. It expires on ${new Date(view.expiresAt).toLocaleDateString()} — upload a renewal before then to keep the badge.`
        : `Your ${kind} is verified. The badge is now showing on your profile.`
      : note,
    type: "credential",
  });

  return NextResponse.json({ ok: true, credential: view, credentials: views });
}
