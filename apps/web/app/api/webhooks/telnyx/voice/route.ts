import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTelnyxSignature } from "@/lib/telnyx-verify";
import { xmlEscape } from "@/lib/voice";

export const runtime = "nodejs";

// Point a Telnyx TeXML Application's "Voice" webhook at this route, and assign
// every pooled proxy number to that application. When someone dials a proxy
// number, Telnyx POSTs the inbound call here (form-encoded) and plays back the
// TeXML we return — we look up the session and <Dial> the counterpart, masking
// both sides behind the proxy number.

function texml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    headers: { "Content-Type": "application/xml" },
  });
}

const sayHangup = (msg: string) => texml(`<Say voice="alice">${xmlEscape(msg)}</Say><Hangup/>`);

export async function POST(req: NextRequest) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  const rawBody = await req.text();

  // Fail closed — never bridge a call we can't authenticate as coming from Telnyx.
  if (!publicKey) {
    console.error("[telnyx/voice] TELNYX_PUBLIC_KEY not configured — rejecting");
    return sayHangup("This service is temporarily unavailable.");
  }

  const sig = req.headers.get("telnyx-signature-ed25519");
  const ts = req.headers.get("telnyx-timestamp");
  if (!verifyTelnyxSignature(rawBody, sig, ts, publicKey)) {
    return new Response("invalid signature", { status: 401 });
  }

  const form = new URLSearchParams(rawBody);
  const from = form.get("From") ?? ""; // the real number of whoever is calling
  const to = form.get("To") ?? ""; // the proxy number they dialed
  const callSid = form.get("CallSid") ?? undefined;

  const session = await prisma.proxySession.findFirst({
    where: { proxyNumber: to, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    return sayHangup("This number is no longer active. Please open the app to call again.");
  }

  // Route to the other party based on who is calling. An unrecognized caller
  // (number not part of this booking) is refused — the proxy is not a hotline.
  let dest: string | null = null;
  if (from === session.customerPhone) dest = session.handymanPhone;
  else if (from === session.handymanPhone) dest = session.customerPhone;

  if (!dest) {
    return sayHangup("We could not connect your call.");
  }

  if (callSid) {
    await prisma.proxySession.update({
      where: { id: session.id },
      data: { lastCallSid: callSid },
    });
  }

  // Bridge the call. callerId is the proxy number, so the callee never sees the
  // caller's real number. timeLimit caps a single call at 1h.
  return texml(
    `<Dial callerId="${xmlEscape(session.proxyNumber)}" timeLimit="3600" answerOnBridge="true">` +
      `<Number>${xmlEscape(dest)}</Number>` +
    `</Dial>`
  );
}
