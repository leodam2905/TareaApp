import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Telnyx signs each webhook with HMAC-SHA256 using the v1_secret from the messaging profile.
// If the signature doesn't match we ignore the request.
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const sig = req.headers.get("telnyx-signature-ed25519") ??
                req.headers.get("x-telnyx-signature");
    if (!verifySignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
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
