import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeLicenceNumber, lookupLicence, licenceLookupUrl, compareLicenseeName, type LicenceIssuer } from "@/lib/license-check";
import { CREDENTIAL_SELECT, credentialViews } from "@/lib/credentials";

// Checks a contractor licence number before it goes to admin review.
//
// It answers what can be answered mechanically — is the number even shaped like
// a CSLB licence, has somebody else already claimed it, what does our own
// record say — and reports honestly that no registry was consulted when none is
// configured. It NEVER approves a licence: `licenseStatus` is only ever set by
// an admin through the credentials queue, because a badge that says "Licensed"
// to a customer has to mean a person looked.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cheap to call and it hits an external registry — bound it per user.
  if (!rateLimit(`licence:${user.id}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Too many checks. Please wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const issuer: LicenceIssuer = body?.issuer === "OTHER" ? "OTHER" : "CSLB";
  const fmt = normalizeLicenceNumber(body?.number, issuer);
  if (!fmt.ok) return NextResponse.json({ ok: false, reason: "format", error: fmt.error }, { status: 400 });

  const number = fmt.normalized!;

  // Somebody else already claiming this number is the one fraud signal we can
  // detect without a registry, and it is worth surfacing before review.
  const claimedByOther = await prisma.handymanProfile.findFirst({
    where: { licenseNumber: number, NOT: { userId: user.id } },
    select: { id: true },
  });

  const mine = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: CREDENTIAL_SELECT,
  });
  const own = mine ? credentialViews(mine).license : null;

  const registry = await lookupLicence(number, issuer);

  // Compared against the pro's own name — a number alone proves nothing when
  // licence numbers are public record.
  const nameMatch = compareLicenseeName(
    typeof body?.licenseeName === "string" ? body.licenseeName : mine?.licenseeName,
    user.name,
  );

  return NextResponse.json({
    ok: true,
    number,
    issuer,
    nameMatch,
    // One click for the reviewer; retyping a number is how digits get
    // transposed and the wrong contractor gets approved.
    lookupUrl: licenceLookupUrl(number, issuer),
    // Our own record of THIS pro's licence.
    onFile: own
      ? { status: own.status, valid: own.valid, expiresAt: own.expiresAt, expiringSoon: own.expiringSoon }
      : null,
    duplicate: !!claimedByOther,
    // checked:false means no registry was consulted — not "the registry says it
    // is fine". Clients must not treat the two the same.
    registry,
    // What actually happens next, in one word the client can render.
    next: claimedByOther || nameMatch === "mismatch"
      ? "blocked"
      : registry.checked && registry.status && registry.status !== "active"
        ? "blocked"
        : own?.valid
          ? "approved"
          : "manual_review",
  });
}
