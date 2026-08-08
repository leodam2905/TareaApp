import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTwilioSignature } from "@/lib/twilio-verify";
import { normalizePhone } from "@/lib/phone";
import { xmlEscape } from "@/lib/voice";

export const runtime = "nodejs";

// Create a Twilio TwiML App whose Voice URL is this route, then set
// `voice_application_sid` on every pooled proxy number. When someone dials a
// proxy number, Twilio POSTs the inbound call here (form-encoded) and plays back
// the TwiML we return — we look up the session and <Dial> the counterpart,
// masking both sides behind the proxy number.

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

const sayHangup = (msg: string) => twiml(`<Say voice="alice">${xmlEscape(msg)}</Say><Hangup/>`);

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const rawBody = await req.text();

  // Fail closed — never bridge a call we can't authenticate as coming from Twilio.
  if (!authToken) {
    console.error("[twilio/voice] TWILIO_AUTH_TOKEN not configured — rejecting");
    return sayHangup("This service is temporarily unavailable.");
  }

  const form = new URLSearchParams(rawBody);
  const params: Record<string, string> = {};
  form.forEach((value, key) => { params[key] = value; });

  // Twilio signs the URL it was configured with. Build it from the public base
  // URL — the proxied request Cloud Run hands us may not carry the right
  // scheme/host, which would break an otherwise-valid signature.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com").replace(/\/$/, "");
  const url = `${base}${req.nextUrl.pathname}${req.nextUrl.search}`;

  if (!verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature"), authToken)) {
    return new Response("invalid signature", { status: 401 });
  }

  const from = normalizePhone(params.From ?? ""); // the real number of whoever is calling
  const to = params.To ?? ""; // the proxy number they dialed
  const callSid = params.CallSid || undefined;

  // Match the caller against the session in the query itself. Allocation
  // guarantees a phone is bound to a given proxy number at most once, so this
  // resolves to exactly one session — no guessing which booking was meant.
  const session = await prisma.proxySession.findFirst({
    where: {
      proxyNumber: to,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      OR: [{ customerPhone: from }, { handymanPhone: from }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    // Either the session lapsed, or the caller isn't party to a booking on this
    // number — the proxy is not a hotline.
    return sayHangup("This number is no longer active. Please open the app to call again.");
  }

  const dest = from === session.customerPhone ? session.handymanPhone : session.customerPhone;

  if (callSid) {
    await prisma.proxySession.update({
      where: { id: session.id },
      data: { lastCallSid: callSid },
    });
  }

  // Bridge the call. callerId is the proxy number, so the callee never sees the
  // caller's real number. timeLimit caps a single call at 1h.
  return twiml(
    `<Dial callerId="${xmlEscape(session.proxyNumber)}" timeLimit="3600" answerOnBridge="true">` +
      `<Number>${xmlEscape(dest)}</Number>` +
    `</Dial>`
  );
}
