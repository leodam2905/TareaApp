import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCredential } from "@/lib/credential-extract";
import { getCurrentUser } from "@/lib/auth";
import {
  CREDENTIAL_KINDS,
  CREDENTIAL_SELECT,
  CredentialKind,
  credentialViews,
  parseExpiry,
} from "@/lib/credentials";

/** The pro's own licence and insurance, with expiry already applied. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: CREDENTIAL_SELECT,
  });
  if (!profile) return NextResponse.json({ error: "No handyman profile" }, { status: 404 });

  return NextResponse.json(credentialViews(profile));
}

/**
 * Submit or replace one credential.
 *
 * Always lands on `pending`, including on a replacement of an already-approved
 * document: a renewed licence is a document nobody has looked at yet. The
 * previous review note and timestamp are cleared for the same reason — they
 * describe a decision about a file that is no longer there.
 *
 * Only ONE credential per call. The two are reviewed separately, so accepting
 * both in one body would make a single request produce two decisions to make
 * and one status to report.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const docUrl = typeof body.docUrl === "string" ? body.docUrl.trim() : "";
  if (!docUrl) {
    return NextResponse.json({ error: "docUrl is required — upload the file to /api/verification first" }, { status: 400 });
  }

  const expiry = parseExpiry(body.expiresAt);
  if (!expiry.ok) return NextResponse.json({ error: expiry.error }, { status: 400 });
  // An already-lapsed document is a wasted round trip through the review queue.
  if (expiry.ok && !expiry.absent && expiry.value && expiry.value.getTime() <= Date.now()) {
    return NextResponse.json({ error: "expiresAt is in the past" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  // Read the document before it reaches the queue, so the admin opens a row
  // that is already filled in rather than one they must transcribe. This is a
  // PROPOSAL — approving is still what writes licenseExpiresAt, and a failed
  // reading returns null and changes nothing.
  const aiExtract = await extractCredential(kind, docUrl);

  if (kind === "license") {
    data.licenseDocUrl = docUrl;
    data.licenseStatus = "pending";
    data.licenseAiExtract = aiExtract ?? undefined;
    data.licenseReviewedAt = null;
    data.licenseReviewNote = null;
    if (!expiry.absent) data.licenseExpiresAt = expiry.value;
    if (typeof body.number === "string") data.licenseNumber = body.number.trim() || null;
    // Who the licence belongs to. Without it a reviewer has a number and no way
    // to tell whose it is — and licence numbers are public record.
    if (typeof body.licenseeName === "string") data.licenseeName = body.licenseeName.trim() || null;
    if (typeof body.issuer === "string") data.licenseIssuer = body.issuer.trim() || null;
  } else {
    data.insuranceDocUrl = docUrl;
    data.insuranceStatus = "pending";
    data.insuranceAiExtract = aiExtract ?? undefined;
    data.insuranceReviewedAt = null;
    data.insuranceReviewNote = null;
    if (!expiry.absent) data.insuranceExpiresAt = expiry.value;
    if (typeof body.provider === "string") data.insuranceProvider = body.provider.trim() || null;
    if (typeof body.policyNumber === "string") data.insurancePolicyNumber = body.policyNumber.trim() || null;
    // The named insured ties a forwardable one-page PDF to THIS pro.
    if (typeof body.namedInsured === "string") data.insuranceNamedInsured = body.namedInsured.trim() || null;
    // Limits arrive as whole dollars. A non-numeric value is rejected rather
    // than coerced to 0, which would read as "no coverage" and reject a pro
    // over a typo.
    for (const [field, column] of [["perOccurrence", "insurancePerOccurrence"], ["aggregate", "insuranceAggregate"]] as const) {
      if (body[field] === undefined || body[field] === null || body[field] === "") continue;
      const n = Math.round(Number(body[field]));
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${field} must be a whole dollar amount` }, { status: 400 });
      }
      data[column] = n;
    }
  }

  const profile = await prisma.handymanProfile.update({
    where: { userId: user.id },
    data,
    select: CREDENTIAL_SELECT,
  }).catch(() => null);

  if (!profile) return NextResponse.json({ error: "No handyman profile" }, { status: 404 });

  const views = credentialViews(profile);
  return NextResponse.json({ ok: true, credential: views[kind], credentials: views });
}
