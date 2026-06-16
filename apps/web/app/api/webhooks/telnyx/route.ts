import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Telnyx signs each webhook with Ed25519 over `${timestamp}|${rawBody}`. The
// public key (base64 raw 32-byte Ed25519 key) is provided in the Telnyx portal.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function verifyTelnyxSignature(
  rawBody: string,
  signatureB64: string | null,
  timestamp: string | null,
  publicKeyB64: string
): boolean {
  if (!signatureB64 || !timestamp) return false;
  try {
    const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyB64, "base64")]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    const signed = Buffer.from(`${timestamp}|${rawBody}`);
    return crypto.verify(null, signed, key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  const rawBody = await req.text();

  // Fail closed — never process an unverified webhook.
  if (!publicKey) {
    console.error("[telnyx/webhook] TELNYX_PUBLIC_KEY not configured — rejecting request");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("telnyx-signature-ed25519");
  const ts = req.headers.get("telnyx-timestamp");
  if (!verifyTelnyxSignature(rawBody, sig, ts, publicKey)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data = event.data as Record<string, unknown> | undefined;
  const eventType = data?.event_type as string | undefined;
  const payload = data?.payload as Record<string, unknown> | undefined;

  if (eventType === "message.finalized" && payload) {
    const msgId = payload.id as string;
    const toList = (payload.to as Array<{ phone_number: string; status: string }>) ?? [];
    const errors = (payload.errors as Array<{ title: string; code: string }>) ?? [];

    for (const recipient of toList) {
      if (recipient.status === "delivered") {
        console.log(`[telnyx] SMS delivered to ${recipient.phone_number} (msg ${msgId})`);
      } else {
        // Surfaces in Cloud Logging — queryable via gcloud logging read 'severity=ERROR'
        console.error(`[telnyx] SMS failed to ${recipient.phone_number} (msg ${msgId}) status=${recipient.status}`, {
          errors,
          messageId: msgId,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
