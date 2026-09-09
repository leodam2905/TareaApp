import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { mapCheckrStatus } from "@/lib/checkr";
import { createNotification } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * Checkr webhooks.
 *
 * Signed with HMAC-SHA256 over the raw body, hex, in `X-Checkr-Signature`.
 * Verified constant-time, and FAILS CLOSED on a missing secret: an unverified
 * payload that can set backgroundCheckStatus is a trust bypass -- anyone who
 * guesses a candidate id could mark themselves screened.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CHECKR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[checkr/webhook] CHECKR_WEBHOOK_SECRET not configured — rejecting");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.arrayBuffer();
  const signature = req.headers.get("x-checkr-signature") ?? "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(rawBody))
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString());
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  return handleEvent(payload);
}

async function handleEvent(payload: Record<string, unknown>) {
  // Checkr shape: { type: "report.completed", data: { object: { id, status,
  // result, candidate_id, ... } } }
  const type = String(payload.type ?? "");
  const object = ((payload.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;

  // Only report events carry a screening outcome. Everything else -- candidate
  // created, invitation opened -- is acknowledged and ignored, because returning
  // non-200 makes Checkr retry an event we will never act on.
  if (!type.startsWith("report.")) return NextResponse.json({ ok: true });

  const candidateId = object.candidate_id as string | undefined;
  const status = String(object.status ?? "");
  const result = (object.result as string | null) ?? null;
  if (!candidateId || !status) return NextResponse.json({ ok: true });

  const ourStatus = mapCheckrStatus(status, result);

  // backgroundCheckRef holds the CANDIDATE id, not the invitation id: a candidate
  // can have several reports over time (re-screens, upgrades) and the candidate
  // is the stable handle across all of them.
  const profile = await prisma.handymanProfile.findFirst({
    where: { backgroundCheckRef: candidateId },
    include: { user: true },
  });
  if (!profile) {
    console.warn("[checkr/webhook] no profile for candidate", candidateId);
    return NextResponse.json({ ok: true });
  }

  await prisma.handymanProfile.update({
    where: { id: profile.id },
    data: { backgroundCheckStatus: ourStatus },
  });

  if (ourStatus === "PASSED") {
    await createNotification({
      userId: profile.userId,
      title: "Background check passed ✓",
      body: "You're fully verified on Tarea. Customers will see your verified badge on your profile.",
      type: "booking_accepted",
      refId: profile.userId,
    });
  } else if (ourStatus === "FAILED") {
    // ⚠️ FCRA: this is NOT an adverse action, and must not read like one.
    //
    // A `consider` result means a human has to look, not that the Pro is
    // rejected. Declining someone on the strength of a report requires a
    // pre-adverse notice with a copy of the report and a summary of rights, a
    // waiting period, then a final notice. Until that process exists, this
    // notification says a review is happening and nothing about the outcome.
    await createNotification({
      userId: profile.userId,
      title: "Background check — under review",
      body: "Your screening needs a manual review before we can finish verifying you. We'll be in touch at support@taptarea.com.",
      type: "booking_accepted",
      refId: profile.userId,
    });
  }

  return NextResponse.json({ ok: true });
}
