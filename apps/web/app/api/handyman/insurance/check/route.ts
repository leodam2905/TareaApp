import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { compareLicenseeName } from "@/lib/license-check";
import { MIN_PER_OCCURRENCE, MIN_AGGREGATE, meetsInsuranceMinimums } from "@/lib/credentials";

// Pre-checks a certificate of insurance before a human reads it.
//
// It CANNOT confirm the policy is in force — no insurer publishes that, and the
// ACORD form says of itself that it "is issued as a matter of information only
// and confers no rights upon the certificate holder". A cancelled policy leaves
// a PDF identical to a live one. Confirming it means emailing the producer.
//
// What this does is take the mechanical parts off the reviewer: does the named
// insured look like this pro, do the limits clear the ICA minimums, and is this
// policy number already on somebody else's account.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`insurance:${user.id}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Too many checks. Please wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const policyNumber = typeof body?.policyNumber === "string" ? body.policyNumber.trim() : "";
  const namedInsured = typeof body?.namedInsured === "string" ? body.namedInsured.trim() : "";
  const perOccurrence = body?.perOccurrence == null ? null : Math.round(Number(body.perOccurrence));
  const aggregate = body?.aggregate == null ? null : Math.round(Number(body.aggregate));

  if (perOccurrence !== null && !Number.isFinite(perOccurrence)) {
    return NextResponse.json({ error: "perOccurrence must be a whole dollar amount" }, { status: 400 });
  }
  if (aggregate !== null && !Number.isFinite(aggregate)) {
    return NextResponse.json({ error: "aggregate must be a whole dollar amount" }, { status: 400 });
  }

  // The same policy on two accounts is either a shared employer policy or a
  // forwarded certificate. Both need a person to look.
  const duplicate = policyNumber
    ? !!(await prisma.handymanProfile.findFirst({
        where: { insurancePolicyNumber: policyNumber, NOT: { userId: user.id } },
        select: { id: true },
      }))
    : false;

  const nameMatch = compareLicenseeName(namedInsured, user.name);
  const meets = meetsInsuranceMinimums(perOccurrence, aggregate);

  return NextResponse.json({
    ok: true,
    nameMatch,
    duplicate,
    limits: {
      perOccurrence,
      aggregate,
      minimums: { perOccurrence: MIN_PER_OCCURRENCE, aggregate: MIN_AGGREGATE },
      meetsMinimums: meets,
    },
    // Never "approved": nothing here proves the policy exists, let alone that
    // it is still in force. A human confirms with the producer.
    next: duplicate || nameMatch === "mismatch" || meets === false ? "blocked" : "manual_review",
    reviewerMustConfirm: "Policy is in force — confirm with the producer named on the certificate.",
  });
}
