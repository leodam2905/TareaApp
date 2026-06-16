import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { mapCertnStatus } from "@/lib/certn";
import { createNotification } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CERTN_WEBHOOK_SECRET;

  // Fail closed: a missing secret must never allow unverified payloads to mark a
  // handyman's background check PASSED (identity/trust bypass).
  if (!secret) {
    console.error("[certn/webhook] CERTN_WEBHOOK_SECRET not configured — rejecting request");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify Certn signature (constant-time)
  const signature = req.headers.get("x-certn-signature") ?? "";
  const rawBody = await req.arrayBuffer();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(rawBody))
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(Buffer.from(rawBody).toString());
  return handleEvent(payload);
}

async function handleEvent(payload: Record<string, unknown>) {
  // Certn webhook shape: { id, status, applicant: { email }, report_url, ... }
  const invitationId = payload.id as string;
  const certnStatus = payload.status as string;

  if (!invitationId || !certnStatus) {
    return NextResponse.json({ ok: true }); // Ignore unknown events
  }

  const our_status = mapCertnStatus(certnStatus);

  const profile = await prisma.handymanProfile.findFirst({
    where: { backgroundCheckRef: invitationId },
    include: { user: true },
  });

  if (!profile) {
    console.warn("[certn/webhook] No profile found for invitation", invitationId);
    return NextResponse.json({ ok: true });
  }

  await prisma.handymanProfile.update({
    where: { id: profile.id },
    data: { backgroundCheckStatus: our_status },
  });

  if (our_status === "PASSED") {
    await createNotification({
      userId: profile.userId,
      title: "Background check passed ✓",
      body: "You're fully verified on Tarea. Customers will see your verified badge on your profile.",
      type: "booking_accepted",
      refId: profile.userId,
    });
  } else if (our_status === "FAILED") {
    await createNotification({
      userId: profile.userId,
      title: "Background check — action required",
      body: "Your background check requires review. Contact support@taptarea.com for next steps.",
      type: "booking_accepted",
      refId: profile.userId,
    });
  }

  return NextResponse.json({ ok: true });
}
